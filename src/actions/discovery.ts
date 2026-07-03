"use server";

import { db, searches, watchlist, discovered, suggestions, applications, sources, stages, tasks, contacts, applicationContacts } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./applications";
import { findApolloContacts } from "./misc";
import { runScan, markDiscovered, type ScanReport } from "@/lib/discovery";
import { scanGmail, createGmailDraft, disconnectGmail, type GmailScanReport } from "@/lib/gmail";
import { llmJson } from "@/lib/llm";
import { getSettings } from "@/lib/settings";

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

export async function scanNow(): Promise<{ discovery: ScanReport; gmail: GmailScanReport }> {
  const discovery = await runScan();
  let gmail: GmailScanReport;
  try {
    gmail = await scanGmail();
  } catch (e) {
    gmail = { scanned: 0, suggested: 0, error: e instanceof Error ? e.message : "failed" };
  }
  revalidate();
  return { discovery, gmail };
}

/* ---------- inbox actions ---------- */

export async function approveDiscovered(id: string): Promise<{ applicationId?: string; error?: string }> {
  const [j] = await db.select().from(discovered).where(eq(discovered.id, id));
  if (!j) return { error: "Not found" };

  // map the discovery source to a pipeline source (create if needed)
  const sourceName = { adzuna: "Adzuna", jsearch: "JSearch", remotive: "Remotive", remoteok: "RemoteOK", hn: "Hacker News", greenhouse: "Company site", lever: "Company site" }[j.source] ?? "Other";
  let src = (await db.select().from(sources)).find((s) => s.name === sourceName);
  if (!src) [src] = await db.insert(sources).values({ name: sourceName, color: "#5aa9e6" }).returning();

  const firstStage = (await db.select().from(stages)).sort((a, b) => a.position - b.position)[0];

  const [app] = await db.insert(applications).values({
    company: j.company, title: j.title, url: j.url,
    location: j.location, workMode: j.remote ? "remote" : null,
    salaryMin: j.salaryMin, salaryMax: j.salaryMax, currency: j.currency ?? "USD",
    sourceId: src?.id ?? null, stageId: firstStage?.id ?? null,
    jdText: j.description,
  }).returning();

  await logActivity(app.id, "created", `Added ${j.title} at ${j.company} (discovered via ${sourceName})`, { to: firstStage?.id ?? null });
  await markDiscovered(id, "approved");

  // auto-fetch referral contacts — best-effort, ignore failures (no key, no matches…)
  const s = await getSettings();
  if (s.apolloApiKey) {
    try { await findApolloContacts(app.id); } catch { /* non-fatal */ }
  }

  revalidate();
  return { applicationId: app.id };
}

export async function dismissDiscovered(id: string) {
  await markDiscovered(id, "dismissed");
  revalidate();
}

/* ---------- gmail suggestions ---------- */

export async function applySuggestion(id: string) {
  const [sg] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!sg || !sg.applicationId) return;
  const [app] = await db.select().from(applications).where(eq(applications.id, sg.applicationId));
  if (!app) return;

  if (sg.proposedStageId && sg.proposedStageId !== app.stageId) {
    const allStages = await db.select().from(stages);
    const from = allStages.find((x) => x.id === app.stageId);
    const to = allStages.find((x) => x.id === sg.proposedStageId);
    await db.update(applications).set({ stageId: sg.proposedStageId, updatedAt: new Date() }).where(eq(applications.id, app.id));
    await logActivity(app.id, "stage_change", `${app.company}: ${from?.name ?? "—"} → ${to?.name ?? "—"} (from email)`, { from: app.stageId, to: sg.proposedStageId });
  }
  await logActivity(sg.applicationId, "note", `📧 ${sg.kind === "interview" ? "Interview email" : sg.kind === "rejection" ? "Rejection email" : "Email reply"}: “${sg.subject ?? ""}”`);
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
