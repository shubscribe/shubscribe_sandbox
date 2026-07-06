import "server-only";
import {
  db, applications, contacts, applicationContacts, campaigns, leads,
  outreachMessages, sequenceSteps, resumes, suggestions, tasks, activities, discovered,
} from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { getSettings, setSettings, type AppSettings } from "./settings";
import { llmJson, hasAiKey } from "./llm";
import { sendGmail, gmailSearchMessages } from "./gmail";

export type Persona = "recruiter" | "manager" | "peer";

const PERSONA_TITLES: Record<Persona, string[]> = {
  recruiter: ["recruiter", "technical recruiter", "talent acquisition"],
  manager: ["engineering manager", "hiring manager", "head of engineering"],
  peer: [], // filled from the user's target role at runtime
};
const LEADS_PER_PERSONA = 2;

export const DEFAULT_SEQUENCE: { persona: Persona; position: number; type: "email" | "dm_task"; delayDays: number; framing: string }[] = [
  { persona: "recruiter", position: 1, type: "email", delayDays: 0, framing: "Introduce yourself, reference the specific open role, say you applied (or are applying) and why you're a strong fit. Ask what the process looks like." },
  { persona: "recruiter", position: 2, type: "email", delayDays: 3, framing: "Short, friendly bump on the previous email. One new detail about fit. Two sentences max." },
  { persona: "recruiter", position: 3, type: "dm_task", delayDays: 4, framing: "LinkedIn DM version: very casual, 40 words max, mention the role and that you emailed." },
  { persona: "manager", position: 1, type: "email", delayDays: 0, framing: "Referral-style note to the likely hiring manager: specific about why their team, one proof point, low-pressure ask for a chat or a referral." },
  { persona: "manager", position: 2, type: "email", delayDays: 4, framing: "Gentle bump, add one concrete thing you'd bring to their roadmap. Short." },
  { persona: "manager", position: 3, type: "dm_task", delayDays: 5, framing: "LinkedIn DM version: casual peer-to-leader tone, 40 words max." },
  { persona: "peer", position: 1, type: "email", delayDays: 0, framing: "Peer-to-peer note: you do similar work, you're interested in their team, ask how they like it and whether they'd be open to referring. Warm, zero pressure." },
  { persona: "peer", position: 2, type: "email", delayDays: 4, framing: "Friendly bump — mention something specific about the company's product/stack. Short." },
  { persona: "peer", position: 3, type: "dm_task", delayDays: 5, framing: "LinkedIn DM version: very casual fellow-engineer tone, 40 words max." },
];

export async function ensureSequenceSeeded() {
  const existing = await db.select().from(sequenceSteps);
  if (existing.length > 0) return;
  await db.insert(sequenceSteps).values(DEFAULT_SEQUENCE);
}

/* ---------------- lead generation (Apollo, persona-aware) ---------------- */

async function apolloSearch(apiKey: string, company: string, titles: string[], n: number) {
  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ q_organization_name: company, person_titles: titles, page: 1, per_page: n }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Apollo ${res.status}`);
  const data = (await res.json()) as {
    people?: Array<{ name?: string; title?: string; email?: string; linkedin_url?: string; organization?: { name?: string } }>;
  };
  return (data.people ?? []).filter((p) => p.name);
}

export async function generateLeads(applicationId: string): Promise<{ contactId: string; persona: Persona }[]> {
  const s = await getSettings();
  if (!s.apolloApiKey) return [];
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app) return [];

  const peerTitles = s.targetRole ? [s.targetRole] : ["software engineer"];
  const out: { contactId: string; persona: Persona }[] = [];
  const existing = await db.select().from(contacts);

  for (const persona of ["recruiter", "manager", "peer"] as Persona[]) {
    const titles = persona === "peer" ? peerTitles : PERSONA_TITLES[persona];
    try {
      const people = await apolloSearch(s.apolloApiKey, app.company, titles, LEADS_PER_PERSONA);
      for (const p of people.slice(0, LEADS_PER_PERSONA)) {
        const dupe = existing.find(
          (c) => c.name.toLowerCase() === p.name!.toLowerCase() && (c.company ?? "").toLowerCase() === app.company.toLowerCase()
        );
        let contactId = dupe?.id;
        if (!contactId) {
          const [row] = await db.insert(contacts).values({
            name: p.name!, title: p.title ?? null, company: p.organization?.name ?? app.company,
            email: p.email && p.email !== "email_not_unlocked@domain.com" ? p.email : null,
            linkedinUrl: p.linkedin_url ?? null, origin: "apollo",
          }).returning();
          contactId = row.id;
          existing.push(row);
        }
        await db.insert(applicationContacts).values({ applicationId, contactId }).onConflictDoNothing();
        out.push({ contactId, persona });
      }
    } catch {
      // persona search failed (rate limit, plan limit) — continue with the others
    }
  }
  return out;
}

/* ---------------- message generation ---------------- */

async function personalizationContext() {
  const s = await getSettings();
  return [
    s.name && `Candidate name: ${s.name}.`,
    s.targetRole && `Target role: ${s.targetRole}.`,
    s.profileBlurb && `About: ${s.profileBlurb}`,
    s.proofPoints && `Proof points (pick the single most relevant one):\n${s.proofPoints}`,
    s.resumeText && `Resume excerpt:\n${s.resumeText.slice(0, 1500)}`,
  ].filter(Boolean).join("\n");
}

export async function draftMessage(leadId: string, position: number): Promise<string | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return null;
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, lead.campaignId));
  const [app] = await db.select().from(applications).where(eq(applications.id, campaign.applicationId));
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, lead.contactId));
  const step = (await db.select().from(sequenceSteps)).find(
    (st) => st.persona === lead.persona && st.position === position
  );
  if (!app || !contact || !step) return null;

  const s = await getSettings();
  const ctx = await personalizationContext();
  const prior = await db.select().from(outreachMessages).where(eq(outreachMessages.leadId, leadId));
  const priorNote = prior.filter((m) => m.status === "sent" && m.type === "email").length
    ? "This is a FOLLOW-UP to an earlier email that got no reply — do not repeat it, keep it shorter."
    : "";

  try {
    const result = await llmJson<{ subject?: string; body: string }>(
      `Write a ${step.type === "dm_task" ? "LinkedIn DM" : "cold outreach email"} for a job seeker.
Recipient: ${contact.name}${contact.title ? `, ${contact.title}` : ""} at ${app.company} (persona: ${lead.persona}).
Job: ${app.title} at ${app.company}.${app.jdText ? `\nJob description excerpt: ${app.jdText.slice(0, 600)}` : ""}
Instruction for this step: ${step.framing}
${priorNote}
Tone: ${s.draftTone}.
${ctx}

Rules: no placeholders like [Name] — use real details or omit. ${step.type === "email" ? "90-130 words." : "Max 45 words, no subject."}
Respond with ONLY JSON: ${step.type === "email" ? `{"subject":"<subject>","body":"<email body>"}` : `{"body":"<dm text>"}`}`
    );
    const [row] = await db.insert(outreachMessages).values({
      leadId, stepPosition: position, type: step.type,
      subject: result.subject ?? null, body: result.body,
    }).returning();
    return row.id;
  } catch {
    return null;
  }
}

/* ---------------- campaign creation ---------------- */

export async function createCampaign(applicationId: string): Promise<{ created: boolean; reason?: string }> {
  const existing = await db.select().from(campaigns).where(eq(campaigns.applicationId, applicationId));
  if (existing.length) return { created: false, reason: "campaign exists" };
  const s = await getSettings();
  if (!s.apolloApiKey) return { created: false, reason: "no Apollo key" };
  if (!(await hasAiKey())) return { created: false, reason: "no AI key" };

  await ensureSequenceSeeded();
  const found = await generateLeads(applicationId);
  if (!found.length) return { created: false, reason: "no leads found" };

  const [campaign] = await db.insert(campaigns).values({ applicationId }).returning();
  for (const f of found) {
    const [lead] = await db.insert(leads).values({
      campaignId: campaign.id, contactId: f.contactId, persona: f.persona,
    }).returning();
    await draftMessage(lead.id, 1);
  }
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  await db.insert(activities).values({
    applicationId,
    type: "note",
    message: `🚀 Outreach campaign created for ${app?.company ?? "company"} — ${found.length} lead(s), messages in the review queue`,
  });
  return { created: true };
}

/* ---------------- sequence progression + pacing + sending ---------------- */

async function leadIsStopped(lead: typeof leads.$inferSelect, campaign: typeof campaigns.$inferSelect) {
  return lead.status !== "active" || campaign.status !== "active";
}

export type TickReport = {
  sent: number; dmTasks: number; drafted: number; cancelled: number;
  replies?: number; digest?: boolean; prepPacks?: number; skipped?: string;
};

/** Morning summary to the user's own inbox — once a day, only if something is waiting. */
async function maybeSendDailyDigest(s: AppSettings): Promise<boolean> {
  if (!s.dailyDigest || !s.gmailConnected || !s.gmailAddress) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (s.lastDigestDay === today || new Date().getHours() < 8) return false;

  const [allMsgs, allDiscovered, allSugs, allTasks] = await Promise.all([
    db.select().from(outreachMessages),
    db.select().from(discovered),
    db.select().from(suggestions),
    db.select().from(tasks),
  ]);
  const queue = allMsgs.filter((m) => m.status === "drafted").length;
  const newJobs = allDiscovered.filter((d) => d.status === "new");
  const pending = allSugs.filter((x) => x.status === "pending").length;
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const dueToday = allTasks.filter((t) => !t.completedAt && t.dueAt && t.dueAt <= endOfToday).length;

  // mark the day even when there's nothing — one check per day, no empty emails
  await setSettings({ lastDigestDay: today });
  if (queue + newJobs.length + pending + dueToday === 0) return false;

  const topJobs = [...newJobs]
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
    .slice(0, 3)
    .map((d) => `  • ${d.title} at ${d.company}${d.fitScore != null ? ` (fit ${d.fitScore})` : ""}`);
  const lines = [
    "Your job-search briefing:",
    "",
    queue > 0 ? `✉ ${queue} outreach draft${queue === 1 ? "" : "s"} waiting for your approval` : null,
    pending > 0 ? `📥 ${pending} inbox suggestion${pending === 1 ? "" : "s"} to review` : null,
    dueToday > 0 ? `☑ ${dueToday} task${dueToday === 1 ? "" : "s"} due today` : null,
    newJobs.length > 0 ? `◈ ${newJobs.length} new job match${newJobs.length === 1 ? "" : "es"}:` : null,
    ...topJobs,
    "",
    "Open Mission Control to act on these.",
  ].filter((l): l is string => l !== null);

  try {
    await sendGmail(s.gmailAddress, `☀️ ${queue > 0 ? `${queue} drafts to approve` : `${newJobs.length + pending + dueToday} things waiting`} — job search briefing`, lines.join("\n"));
    return true;
  } catch {
    return false;
  }
}

export async function runTick(): Promise<TickReport> {
  const s = await getSettings();
  const report: TickReport = { sent: 0, dmTasks: 0, drafted: 0, cancelled: 0 };

  /* 0) reply check FIRST — never draft or send a bump to someone who already answered.
     Runs before data is fetched so the rest of the tick sees fresh lead statuses. */
  if (s.gmailConnected) {
    try {
      report.replies = await detectReplies(gmailSearchMessages);
    } catch {
      // Gmail hiccup — skip sends this tick rather than risk a double-send
      report.skipped = "reply check failed; sends deferred";
      return report;
    }
  }

  /* 0.5) morning digest to self (independent of the send window) */
  report.digest = await maybeSendDailyDigest(s);

  const allCampaigns = await db.select().from(campaigns);
  const allLeads = await db.select().from(leads);
  const allMsgs = await db.select().from(outreachMessages);
  const steps = await db.select().from(sequenceSteps);

  /* 1) progress sequences: draft the next step where the delay has passed */
  for (const lead of allLeads) {
    const campaign = allCampaigns.find((c) => c.id === lead.campaignId);
    if (!campaign || (await leadIsStopped(lead, campaign))) continue;
    const mine = allMsgs.filter((m) => m.leadId === lead.id);
    const lastSent = mine.filter((m) => m.status === "sent").sort((a, b) => b.stepPosition - a.stepPosition)[0];
    if (!lastSent?.sentAt) continue;
    const nextPos = lastSent.stepPosition + 1;
    if (mine.some((m) => m.stepPosition >= nextPos && m.status !== "cancelled" && m.status !== "skipped")) continue;
    const nextStep = steps.find((st) => st.persona === lead.persona && st.position === nextPos);
    if (!nextStep) {
      await db.update(leads).set({ status: "done" }).where(eq(leads.id, lead.id));
      continue;
    }
    if (Date.now() - lastSent.sentAt.getTime() >= nextStep.delayDays * 86400000) {
      const id = await draftMessage(lead.id, nextPos);
      if (id) report.drafted++;
    }
  }

  /* 1.5) autopilot prep packs for interviewing-stage apps (one per tick) */
  try {
    const { autoPrepTick } = await import("./prep");
    report.prepPacks = await autoPrepTick();
  } catch {
    // prep generation is best-effort
  }

  /* 2) release approved messages within window + cap */
  if (s.outreachPaused) { report.skipped = "outreach paused"; return report; }
  const hour = new Date().getHours();
  if (hour < s.sendWindowStart || hour >= s.sendWindowEnd) { report.skipped = "outside send window"; return report; }

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const sentToday = allMsgs.filter((m) => m.sentAt && m.sentAt >= startOfDay).length;
  let budget = Math.max(0, s.dailySendCap - sentToday);
  // spread through the window: at most 2 per tick
  budget = Math.min(budget, 2);

  const approved = allMsgs
    .filter((m) => m.status === "approved")
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

  const defaultResume = (await db.select().from(resumes)).find((r) => r.isDefault);

  for (const msg of approved) {
    if (budget <= 0) break;
    const lead = allLeads.find((l) => l.id === msg.leadId);
    const campaign = lead && allCampaigns.find((c) => c.id === lead.campaignId);
    if (!lead || !campaign || (await leadIsStopped(lead, campaign))) {
      await db.update(outreachMessages).set({ status: "cancelled" }).where(eq(outreachMessages.id, msg.id));
      report.cancelled++;
      continue;
    }
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, lead.contactId));

    if (msg.type === "dm_task") {
      // DM steps become a task carrying the text — nothing is auto-sent to LinkedIn
      await db.insert(tasks).values({
        applicationId: campaign.applicationId,
        title: `Send LinkedIn DM to ${contact?.name ?? "lead"}`,
        notes: msg.body,
        linkUrl: contact?.linkedinUrl ?? null,
        dueAt: new Date(Date.now() + 86400000),
      });
      await db.insert(activities).values({
        applicationId: campaign.applicationId, type: "note",
        message: `💬 DM ready for ${contact?.name ?? "lead"}: “${msg.body.slice(0, 180)}”`,
      });
      await db.update(outreachMessages).set({ status: "sent", sentAt: new Date() }).where(eq(outreachMessages.id, msg.id));
      report.dmTasks++;
      continue; // DM tasks don't consume email budget
    }

    if (!contact?.email) {
      await db.update(outreachMessages).set({ status: "cancelled" }).where(eq(outreachMessages.id, msg.id));
      report.cancelled++;
      continue;
    }
    try {
      const [appRow] = await db.select().from(applications).where(eq(applications.id, campaign.applicationId));
      const resumeRow = campaign.resumeId
        ? (await db.select().from(resumes).where(eq(resumes.id, campaign.resumeId)))[0]
        : defaultResume;
      const attach = msg.stepPosition === 1 && resumeRow
        ? { filename: resumeRow.filename, mime: resumeRow.mime, base64: resumeRow.data }
        : undefined;
      const threadId = await sendGmail(contact.email, msg.subject ?? `Regarding the ${appRow?.title ?? "open"} role`, msg.body, attach);
      await db.update(outreachMessages)
        .set({ status: "sent", sentAt: new Date(), gmailThreadId: threadId || null })
        .where(eq(outreachMessages.id, msg.id));
      await db.insert(activities).values({
        applicationId: campaign.applicationId, type: "follow_up",
        message: `📤 Emailed ${contact.name} (${lead.persona}, step ${msg.stepPosition}): “${msg.subject}”`,
      });
      report.sent++;
      budget--;
    } catch {
      // leave approved; next tick retries (e.g. Gmail token hiccup)
    }
  }
  return report;
}

/* ---------------- reply detection + stop rules ---------------- */

export async function detectReplies(
  gmailSearch: (q: string) => Promise<{ id: string; threadId: string }[]>
): Promise<number> {
  const activeLeads = (await db.select().from(leads)).filter((l) => l.status === "active");
  if (!activeLeads.length) return 0;
  const contactRows = await db.select().from(contacts).where(
    inArray(contacts.id, activeLeads.map((l) => l.contactId))
  );
  const withEmail = contactRows.filter((c) => c.email);
  let replies = 0;

  for (let i = 0; i < withEmail.length; i += 15) {
    const batch = withEmail.slice(i, i + 15);
    const q = `newer_than:14d from:(${batch.map((c) => c.email).join(" OR ")})`;
    let hits: { id: string; threadId: string }[] = [];
    try { hits = await gmailSearch(q); } catch { continue; }
    if (!hits.length) continue;

    // find which leads replied by re-querying per contact (cheap: only on hits)
    for (const c of batch) {
      let mine: { id: string; threadId: string }[] = [];
      try { mine = await gmailSearch(`newer_than:14d from:${c.email}`); } catch { continue; }
      if (!mine.length) continue;
      const lead = activeLeads.find((l) => l.contactId === c.id);
      if (!lead) continue;
      await db.update(leads).set({ status: "replied" }).where(eq(leads.id, lead.id));
      await db.update(outreachMessages)
        .set({ status: "cancelled" })
        .where(and(eq(outreachMessages.leadId, lead.id), inArray(outreachMessages.status, ["drafted", "approved", "scheduled"])));
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, lead.campaignId));
      if (campaign) {
        await db.insert(suggestions).values({
          applicationId: campaign.applicationId,
          gmailThreadId: mine[0].threadId,
          subject: `Reply from ${c.name}`,
          fromAddr: c.email,
          snippet: "An outreach lead replied — their sequence has been stopped automatically.",
          kind: "reply",
          proposedTask: `Reply to ${c.name}`,
        });
      }
      replies++;
    }
  }
  return replies;
}

/** Cancel all pending outreach for an application (stage hit Interviewing/terminal). */
export async function stopCampaignForApplication(applicationId: string, reason: string) {
  const rows = await db.select().from(campaigns).where(eq(campaigns.applicationId, applicationId));
  for (const campaign of rows) {
    if (campaign.status !== "active") continue;
    await db.update(campaigns).set({ status: "stopped" }).where(eq(campaigns.id, campaign.id));
    const campaignLeads = await db.select().from(leads).where(eq(leads.campaignId, campaign.id));
    for (const lead of campaignLeads) {
      if (lead.status === "active") {
        await db.update(leads).set({ status: "stopped" }).where(eq(leads.id, lead.id));
      }
      await db.update(outreachMessages)
        .set({ status: "cancelled" })
        .where(and(eq(outreachMessages.leadId, lead.id), inArray(outreachMessages.status, ["drafted", "approved", "scheduled"])));
    }
    await db.insert(activities).values({
      applicationId, type: "note",
      message: `🛑 Outreach campaign stopped — ${reason}`,
    });
  }
}
