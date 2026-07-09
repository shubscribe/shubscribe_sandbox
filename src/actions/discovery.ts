"use server";

import { db, searches, watchlist, suggestions, applications, stages, tasks, contacts, applicationContacts, sources, resumes, discovered as discoveredTable } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./applications";
import { findApolloContacts } from "./misc";
import { runScan, runAutopilot, markDiscovered, parseResumeProfile, runResumeDiscovery, type ScanReport, type AutopilotReport, type ResumeProfile, type ResumeDiscoveryReport } from "@/lib/discovery";
import { scanGmail, scanInboxApplications, createGmailDraft, disconnectGmail, type GmailScanReport, type InboxReport } from "@/lib/gmail";
import { llmJson } from "@/lib/llm";
import { getSettings, setSettings } from "@/lib/settings";

function revalidate() {
  revalidatePath("/", "layout");
}

/* ---------- saved searches ---------- */

export async function createSearch(input: {
  name: string; keywords: string; location?: string | null;
  remoteOnly?: boolean; salaryMin?: number | null;
}) {
  await db.insert(searches).values({
    name: input.name, keywords: input.keywords,
    location: input.location || null,
    remoteOnly: input.remoteOnly ?? false,
    salaryMin: input.salaryMin ?? null,
  });
  revalidate();
}

export async function toggleSearch(id: string, enabled: boolean) {
  await db.update(searches).set({ enabled }).where(eq(searches.id, id));
  revalidate();
}

export async function deleteSearch(id: string) {
  await db.delete(searches).where(eq(searches.id, id));
  revalidate();
}

/* ---------- company watchlist ---------- */

export async function addWatch(input: { company: string; ats: "greenhouse" | "lever"; slug: string; keywords?: string | null }) {
  await db.insert(watchlist).values({
    company: input.company, ats: input.ats, slug: input.slug.toLowerCase().trim(),
    keywords: input.keywords || null,
  });
  revalidate();
}

export async function deleteWatch(id: string) {
  await db.delete(watchlist).where(eq(watchlist.id, id));
  revalidate();
}

/* ---------- scan ---------- */

export async function scanNow(): Promise<{ discovery: ScanReport; gmail: GmailScanReport; autopilot: AutopilotReport; inbox?: InboxReport }> {
  const discovery = await runScan();
  const autopilot = await runAutopilot();
  let gmail: GmailScanReport;
  try {
    gmail = await scanGmail();
  } catch (e) {
    gmail = { scanned: 0, suggested: 0, error: e instanceof Error ? e.message : "failed" };
  }
  let inbox: InboxReport | undefined;
  try {
    inbox = await scanInboxApplications();
  } catch (e) {
    inbox = { scanned: 0, added: 0, suggested: 0, loggedReplies: 0, error: e instanceof Error ? e.message : "failed" };
  }
  revalidate();
  return { discovery, gmail, autopilot, inbox };
}

/* ---------- résumé-powered discovery ---------- */

export type ResumeDiscoverResult = {
  ok?: true;
  error?: string;
  profile?: ResumeProfile;
  report?: ResumeDiscoveryReport;
  autopilot?: AutopilotReport;
};

export async function uploadResumeAndDiscover(formData: FormData): Promise<ResumeDiscoverResult> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file" };
  if (file.size > 3.5 * 1024 * 1024) return { error: "Keep the résumé under 3.5 MB" };

  const settings = await getSettings();
  if (!settings.aiProvider || !settings.aiApiKey) {
    return { error: "Add an AI key in Settings first — résumé parsing needs it." };
  }

  let text = "";
  let buf: Buffer;
  try {
    const arrayBuf = await file.arrayBuffer();
    buf = Buffer.from(arrayBuf);
    
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default || await import("pdf-parse/lib/pdf-parse.js");
      const parsed = await (pdfParse as any)(buf);
      text = parsed.text ?? "";
    } else {
      text = buf.toString("utf8");
      if (!text) {
         return { error: `Text file conversion failed. Buffer size: ${buf.length}` };
      }
    }
  } catch (e: unknown) {
    return { error: `Couldn't read that file: ${e instanceof Error ? e.message : String(e)}` };
  }
  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 20) return { error: `That résumé looks empty. Length: ${text.length} chars. Name: ${file.name}, Size: ${file.size}, Type: ${file.type}` };

  // 2) store the file (so it can also attach to outreach) + keep the text
  const existingResumes = await db.select().from(resumes);
  await db.insert(resumes).values({
    name: file.name.replace(/\.(pdf|txt|md)$/i, "") || "Résumé",
    filename: file.name, mime: file.type || "application/pdf",
    data: buf.toString("base64"), isDefault: existingResumes.length === 0,
  });
  await setSettings({ resumeText: text.slice(0, 6000) });

  // 3) AI parse → structured profile
  const profile = await parseResumeProfile(text);
  if (!profile || profile.targetTitles.length === 0) {
    return { error: "AI couldn't parse the résumé (it may be rate-limited). Try again in a minute." };
  }
  await setSettings({ resumeProfile: JSON.stringify(profile) });

  // 4) update profile fields (fill blanks; always set target role from the résumé)
  const blurb = !settings.profileBlurb
    ? [
        profile.yearsExperience ? `${profile.yearsExperience}+ years'` : "Experienced",
        profile.seniority, profile.targetTitles[0],
        profile.coreSkills.length ? `— strongest in ${profile.coreSkills.slice(0, 5).join(", ")}` : "",
        profile.domains.length ? `. Background in ${profile.domains.slice(0, 3).join(", ")}.` : ".",
      ].filter(Boolean).join(" ")
    : undefined;
  await setSettings({ targetRole: profile.targetTitles[0], ...(blurb ? { profileBlurb: blurb } : {}) });

  // 5) create/update the recurring "From your résumé" saved search
  const topSkills = profile.coreSkills.slice(0, 2).join(" ");
  const searchName = "From your résumé";
  const existingSearch = (await db.select().from(searches)).find((x) => x.name === searchName);
  const searchVals = {
    name: searchName,
    keywords: `${profile.targetTitles[0]}${topSkills ? ` ${topSkills}` : ""}`.trim(),
    location: profile.remotePref === "remote" ? null : (profile.locations[0] ?? null),
    remoteOnly: profile.remotePref === "remote",
    salaryMin: profile.minSalary,
    enabled: true,
  };
  let searchId: string;
  if (existingSearch) {
    await db.update(searches).set(searchVals).where(eq(searches.id, existingSearch.id));
    searchId = existingSearch.id;
  } else {
    const [row] = await db.insert(searches).values(searchVals).returning();
    searchId = row.id;
  }

  // 6) run the résumé discovery now, then full autopilot on high-fit results
  const report = await runResumeDiscovery(searchId);
  const autopilot = await runAutopilot();

  revalidate();
  return { ok: true, profile, report, autopilot };
}

/* ---------- inbox actions ---------- */

export async function approveDiscovered(id: string): Promise<{ applicationId?: string; error?: string }> {
  const { approveDiscoveredCore } = await import("@/lib/discovery");
  const res = await approveDiscoveredCore(id);
  if (!res.applicationId) { revalidate(); return res; }

  // v3: approval kicks off the full lead→message→campaign chain (best-effort)
  const { createCampaign } = await import("@/lib/outreach");
  const c = await createCampaign(res.applicationId);
  if (!c.created && c.reason !== "campaign exists") {
    // fall back to plain contact-finding when campaign prereqs are missing (e.g. no AI key)
    const s = await getSettings();
    if (s.apolloApiKey) {
      try { await findApolloContacts(res.applicationId); } catch { /* non-fatal */ }
    }
  }

  revalidate();
  return res;
}

export async function dismissDiscovered(id: string, reason?: string) {
  if (reason) {
    const [row] = await db.select().from(discoveredTable).where(eq(discoveredTable.id, id));
    if (row) {
      const s = await getSettings();
      const line = `${row.company} — ${row.title} (${reason})`;
      const lines = [...s.dismissTastes.split("\n").filter(Boolean), line].slice(-30);
      await setSettings({ dismissTastes: lines.join("\n") });
    }
  }
  await markDiscovered(id, "dismissed");
  revalidate();
}

/* ---------- gmail suggestions ---------- */

export async function applySuggestion(id: string) {
  const [sg] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!sg) return;

  // "applied" suggestion with no linked app → create a new application from the email
  if (!sg.applicationId && sg.kind === "applied" && sg.proposedCompany) {
    // dedupe: if this company is already tracked, don't create a twin
    const company = sg.proposedCompany.toLowerCase().trim();
    const dupe = (await db.select().from(applications))
      .find((a) => !a.archived && (a.company.toLowerCase().includes(company) || company.includes(a.company.toLowerCase())));
    if (dupe) {
      await logActivity(dupe.id, "note", `📧 Application email matched an existing entry — “${sg.subject ?? ""}”`);
      await db.update(suggestions).set({ status: "applied" }).where(eq(suggestions.id, id));
      revalidate();
      return;
    }
    const allSources = await db.select().from(sources);
    let emailSource = allSources.find((x) => x.name.toLowerCase() === "email")?.id ?? null;
    if (!emailSource) {
      const [row] = await db.insert(sources).values({ name: "Email", color: "#a78bfa" }).returning();
      emailSource = row.id;
    }
    const [created] = await db.insert(applications).values({
      company: sg.proposedCompany,
      title: sg.proposedTitle || "Role from email",
      sourceId: emailSource,
      stageId: sg.proposedStageId ?? null,
      appliedAt: sg.createdAt ?? new Date(),
      emailThreadId: sg.gmailThreadId,
    }).returning();
    await logActivity(created.id, "created", `📧 Added from an application email — ${sg.proposedCompany}`);
    await db.update(suggestions).set({ status: "applied" }).where(eq(suggestions.id, id));
    revalidate();
    return;
  }

  if (!sg.applicationId) return;
  const [app] = await db.select().from(applications).where(eq(applications.id, sg.applicationId));
  if (!app) return;

  if (sg.proposedStageId && sg.proposedStageId !== app.stageId) {
    const allStages = await db.select().from(stages);
    const from = allStages.find((x) => x.id === app.stageId);
    const to = allStages.find((x) => x.id === sg.proposedStageId);
    await db.update(applications).set({ stageId: sg.proposedStageId, updatedAt: new Date() }).where(eq(applications.id, app.id));
    await logActivity(app.id, "stage_change", `${app.company}: ${from?.name ?? "—"} → ${to?.name ?? "—"} (from email)`, { from: app.stageId, to: sg.proposedStageId });
  }
  const kindLabel = sg.kind === "interview" ? "Interview email" : sg.kind === "rejection" ? "Rejection email" : sg.kind === "offer" ? "Offer email" : "Email reply";
  await logActivity(sg.applicationId, "note", `📧 ${kindLabel}: “${sg.subject ?? ""}”`);
  if (sg.proposedTask) {
    await db.insert(tasks).values({
      applicationId: sg.applicationId, title: sg.proposedTask,
      dueAt: new Date(Date.now() + 86400000),
    });
  }
  await db.update(suggestions).set({ status: "applied" }).where(eq(suggestions.id, id));
  revalidate();
}

export async function dismissSuggestion(id: string) {
  await db.update(suggestions).set({ status: "dismissed" }).where(eq(suggestions.id, id));
  revalidate();
}

export async function gmailDisconnect() {
  await disconnectGmail();
  revalidate();
}

/* ---------- AI drafts (referral requests + stale follow-ups) ---------- */

export type Draft = { emailSubject: string; emailBody: string; dm: string };

export async function generateDraft(input: {
  applicationId: string;
  contactId?: string | null;
  kind: "referral" | "followup";
  tone: "warm" | "direct" | "formal";
}): Promise<Draft | { error: string }> {
  const [app] = await db.select().from(applications).where(eq(applications.id, input.applicationId));
  if (!app) return { error: "Application not found" };
  const contact = input.contactId
    ? (await db.select().from(contacts).where(eq(contacts.id, input.contactId)))[0]
    : null;
  const s = await getSettings();

  const who = contact ? `${contact.name}${contact.title ? `, ${contact.title}` : ""} at ${contact.company ?? app.company}` : `a contact at ${app.company}`;
  const me = [s.name && `My name is ${s.name}.`, s.targetRole && `I'm targeting ${s.targetRole} roles.`, s.profileBlurb && `About me: ${s.profileBlurb}`]
    .filter(Boolean).join(" ") || "I'm a software engineer actively job hunting.";
  const job = `${app.title} at ${app.company}${app.url ? ` (${app.url})` : ""}${app.jdText ? `\nJob description excerpt: ${app.jdText.slice(0, 800)}` : ""}`;

  const ask = input.kind === "referral"
    ? `Write a referral request to ${who}. I want them to refer me for this job. Keep it low-pressure, specific about why I'm a fit, and easy to say yes to.`
    : `Write a polite follow-up about my application to this job — it has been quiet for a while and I want to nudge without being pushy. Address it to ${who}.`;

  try {
    return await llmJson<Draft>(
      `${ask}\n\nTone: ${input.tone}.\n${me}\n\nJob: ${job}\n\nRespond with ONLY JSON:\n{"emailSubject": "<subject line>", "emailBody": "<full email, 90-140 words, no placeholders like [Name] — use real details or omit>", "dm": "<LinkedIn DM version, max 55 words, casual>"}`
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Draft generation failed" };
  }
}

export async function saveDraftToGmail(input: { to: string; subject: string; body: string }): Promise<{ ok?: true; error?: string }> {
  try {
    await createGmailDraft(input.to, input.subject, input.body);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create Gmail draft" };
  }
}

/* ---------- queries for pages ---------- */

export async function fetchLinkedContacts(applicationId: string) {
  const links = await db.select().from(applicationContacts).where(eq(applicationContacts.applicationId, applicationId));
  if (!links.length) return [];
  const all = await db.select().from(contacts);
  return all.filter((c) => links.some((l) => l.contactId === c.id));
}
