"use server";

import {
  db,
  interviews,
  tasks,
  contacts,
  applicationContacts,
  stages,
  sources,
  tags,
  applications,
} from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./applications";
import { setSettings, type AppSettings } from "@/lib/settings";

function revalidate() {
  revalidatePath("/", "layout");
}

/* ---------- interviews ---------- */

export async function createInterview(input: {
  applicationId: string;
  round: string;
  scheduledAt?: number | null;
  format?: string | null;
  interviewers?: string | null;
  prepNotes?: string | null;
}) {
  const [row] = await db
    .insert(interviews)
    .values({
      applicationId: input.applicationId,
      round: input.round,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      format: input.format || null,
      interviewers: input.interviewers || null,
      prepNotes: input.prepNotes || null,
      outcome: "pending",
    })
    .returning();
  await logActivity(input.applicationId, "interview", `Interview scheduled: ${input.round}`);
  revalidate();
  return row.id;
}

export async function updateInterview(
  id: string,
  patch: {
    round?: string;
    scheduledAt?: number | null;
    format?: string | null;
    interviewers?: string | null;
    prepNotes?: string | null;
    outcome?: string | null;
  }
) {
  const { scheduledAt, ...rest } = patch;
  await db
    .update(interviews)
    .set({
      ...rest,
      ...(scheduledAt !== undefined
        ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
        : {}),
    })
    .where(eq(interviews.id, id));
  revalidate();
}

export async function deleteInterview(id: string) {
  await db.delete(interviews).where(eq(interviews.id, id));
  revalidate();
}

/* ---------- tasks ---------- */

export async function createTask(input: {
  title: string;
  applicationId?: string | null;
  dueAt?: number | null;
}) {
  const [row] = await db
    .insert(tasks)
    .values({
      title: input.title,
      applicationId: input.applicationId || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .returning();
  if (input.applicationId) {
    await logActivity(input.applicationId, "task", `Task added: ${input.title}`);
  }
  revalidate();
  return row.id;
}

export async function setTaskCompleted(id: string, completed: boolean) {
  await db
    .update(tasks)
    .set({ completedAt: completed ? new Date() : null })
    .where(eq(tasks.id, id));
  revalidate();
}

export async function snoozeTask(id: string, days: number) {
  const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!t) return;
  const base = t.dueAt && t.dueAt.getTime() > Date.now() ? t.dueAt : new Date();
  await db
    .update(tasks)
    .set({ dueAt: new Date(base.getTime() + days * 86400000) })
    .where(eq(tasks.id, id));
  revalidate();
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidate();
}

/* ---------- contacts ---------- */

export async function createContact(input: {
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  origin?: string;
  applicationId?: string | null;
}) {
  const [row] = await db
    .insert(contacts)
    .values({
      name: input.name,
      title: input.title || null,
      company: input.company || null,
      email: input.email || null,
      phone: input.phone || null,
      linkedinUrl: input.linkedinUrl || null,
      notes: input.notes || null,
      origin: input.origin || "manual",
    })
    .returning();
  if (input.applicationId) {
    await db
      .insert(applicationContacts)
      .values({ applicationId: input.applicationId, contactId: row.id });
    await logActivity(input.applicationId, "contact", `Contact added: ${input.name}`);
  }
  revalidate();
  return row.id;
}

export async function updateContact(
  id: string,
  patch: Partial<{
    name: string;
    title: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    notes: string | null;
  }>
) {
  await db.update(contacts).set(patch).where(eq(contacts.id, id));
  revalidate();
}

export async function deleteContact(id: string) {
  await db.delete(contacts).where(eq(contacts.id, id));
  revalidate();
}

export async function linkContact(applicationId: string, contactId: string) {
  await db
    .insert(applicationContacts)
    .values({ applicationId, contactId })
    .onConflictDoNothing();
  revalidate();
}

export async function unlinkContact(applicationId: string, contactId: string) {
  await db
    .delete(applicationContacts)
    .where(
      and(
        eq(applicationContacts.applicationId, applicationId),
        eq(applicationContacts.contactId, contactId)
      )
    );
  revalidate();
}

/* ---------- stages / sources / tags ---------- */

export async function createStage(name: string, color: string, isTerminal: boolean) {
  const existing = await db.select().from(stages);
  await db
    .insert(stages)
    .values({ name, color, isTerminal, position: existing.length });
  revalidate();
}

export async function updateStage(
  id: string,
  patch: Partial<{ name: string; color: string; isTerminal: boolean }>
) {
  await db.update(stages).set(patch).where(eq(stages.id, id));
  revalidate();
}

export async function reorderStages(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(stages).set({ position: i }).where(eq(stages.id, orderedIds[i]));
  }
  revalidate();
}

export async function deleteStage(id: string) {
  // reassign applications in this stage to the first remaining stage
  const remaining = (await db.select().from(stages)).filter((s) => s.id !== id);
  const fallback = remaining.sort((a, b) => a.position - b.position)[0];
  if (fallback) {
    await db
      .update(applications)
      .set({ stageId: fallback.id })
      .where(eq(applications.stageId, id));
  }
  await db.delete(stages).where(eq(stages.id, id));
  revalidate();
}

export async function createSource(name: string, color: string) {
  await db.insert(sources).values({ name, color });
  revalidate();
}

export async function deleteSource(id: string) {
  await db.delete(sources).where(eq(sources.id, id));
  revalidate();
}

export async function createTag(name: string, color: string) {
  const [row] = await db.insert(tags).values({ name, color }).returning();
  revalidate();
  return row.id;
}

export async function deleteTag(id: string) {
  await db.delete(tags).where(eq(tags.id, id));
  revalidate();
}

/* ---------- settings / onboarding / danger zone ---------- */

export async function saveSettings(patch: Partial<AppSettings>) {
  await setSettings(patch);
  revalidate();
}

const DEFAULT_SOURCES = [
  ["LinkedIn", "#0a66c2"],
  ["Indeed", "#2557a7"],
  ["ZipRecruiter", "#1d924a"],
  ["Dice", "#eb1c26"],
  ["Company site", "#8b8bf5"],
  ["Referral", "#f0a84b"],
  ["Cold outreach", "#f9a8d4"],
] as const;

export async function completeOnboarding(input: {
  settings: Partial<AppSettings>;
  stages: { name: string; color: string; isTerminal: boolean }[];
}) {
  const existingStages = await db.select().from(stages);
  if (existingStages.length === 0 && input.stages.length > 0) {
    await db
      .insert(stages)
      .values(input.stages.map((s, i) => ({ ...s, position: i })));
  }
  const existingSources = await db.select().from(sources);
  if (existingSources.length === 0) {
    await db.insert(sources).values(DEFAULT_SOURCES.map(([name, color]) => ({ name, color })));
  }
  await setSettings({ ...input.settings, onboarded: true });
  revalidate();
}

export async function clearDemoData() {
  await db.delete(applications).where(eq(applications.demo, true));
  // demo contacts are marked via origin
  await db.delete(contacts).where(eq(contacts.origin, "demo"));
  const { discovered } = await import("@/db");
  const { like } = await import("drizzle-orm");
  await db.delete(discovered).where(like(discovered.externalId, "demo-%"));
  revalidate();
}

export async function deleteAllData() {
  await db.delete(applications);
  await db.delete(contacts);
  await db.delete(tasks);
  revalidate();
}

export async function bulkImport(
  rows: Array<{
    company: string;
    title: string;
    url?: string;
    location?: string;
    workMode?: string;
    jobType?: string;
    salaryMin?: number;
    salaryMax?: number;
    stageName?: string;
    sourceName?: string;
    appliedAt?: string;
    notes?: string;
  }>
) {
  const allStages = await db.select().from(stages);
  const allSources = await db.select().from(sources);
  let imported = 0;
  for (const r of rows) {
    if (!r.company || !r.title) continue;
    const stage = r.stageName
      ? allStages.find((s) => s.name.toLowerCase() === r.stageName!.toLowerCase())
      : allStages[0];
    let source = r.sourceName
      ? allSources.find((s) => s.name.toLowerCase() === r.sourceName!.toLowerCase())
      : undefined;
    if (r.sourceName && !source) {
      const [ns] = await db
        .insert(sources)
        .values({ name: r.sourceName, color: "#7dd3fc" })
        .returning();
      allSources.push(ns);
      source = ns;
    }
    await db.insert(applications).values({
      company: r.company,
      title: r.title,
      url: r.url || null,
      location: r.location || null,
      workMode: r.workMode || null,
      jobType: r.jobType || null,
      salaryMin: r.salaryMin ?? null,
      salaryMax: r.salaryMax ?? null,
      stageId: stage?.id ?? allStages[0]?.id ?? null,
      sourceId: source?.id ?? null,
      appliedAt: r.appliedAt ? new Date(r.appliedAt) : null,
      notes: r.notes || null,
    });
    imported++;
  }
  revalidate();
  return imported;
}

export async function findApolloContacts(applicationId: string) {
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings();
  if (!s.apolloApiKey) return { error: "Add your Apollo API key in Settings → Integrations first." };
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app) return { error: "Application not found." };

  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": s.apolloApiKey,
    },
    body: JSON.stringify({
      q_organization_name: app.company,
      person_titles: ["recruiter", "talent acquisition", "hiring manager", "head of talent"],
      page: 1,
      per_page: 5,
    }),
  });
  if (!res.ok) {
    return { error: `Apollo API error (${res.status}). Check your API key and plan.` };
  }
  const data = (await res.json()) as {
    people?: Array<{
      name?: string;
      title?: string;
      email?: string;
      linkedin_url?: string;
      organization?: { name?: string };
    }>;
  };
  const people = data.people ?? [];
  if (!people.length) return { error: `No recruiters found at ${app.company} on Apollo.` };

  const existing = await db.select().from(contacts);
  let added = 0;
  for (const p of people) {
    if (!p.name) continue;
    const dupe = existing.find(
      (c) => c.name.toLowerCase() === p.name!.toLowerCase() && c.company === (p.organization?.name ?? app.company)
    );
    let contactId = dupe?.id;
    if (!contactId) {
      const [row] = await db
        .insert(contacts)
        .values({
          name: p.name,
          title: p.title || null,
          company: p.organization?.name ?? app.company,
          email: p.email && p.email !== "email_not_unlocked@domain.com" ? p.email : null,
          linkedinUrl: p.linkedin_url || null,
          origin: "apollo",
        })
        .returning();
      contactId = row.id;
      added++;
    }
    await db
      .insert(applicationContacts)
      .values({ applicationId, contactId })
      .onConflictDoNothing();
  }
  await logActivity(applicationId, "contact", `Pulled ${added} contact(s) from Apollo`);
  revalidate();
  return { added, linked: people.length };
}

/* ---------- stage id list helper for undo of bulk ops ---------- */
export async function getApplicationsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(applications).where(inArray(applications.id, ids));
}

/* ---------- queries used by client components ---------- */
export async function fetchApplication(id: string) {
  const { getApplication } = await import("@/lib/data");
  return getApplication(id);
}

export async function fetchAllContacts() {
  return db.select().from(contacts).orderBy(contacts.name);
}
