"use server";

import { db, applications, activities, applicationTags, stages } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function revalidate() {
  revalidatePath("/", "layout");
}

export async function logActivity(
  applicationId: string | null,
  type: string,
  message: string,
  meta?: Record<string, unknown>
) {
  await db.insert(activities).values({
    applicationId,
    type,
    message,
    meta: meta ? JSON.stringify(meta) : null,
  });
  if (applicationId) {
    await db
      .update(applications)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
  }
}

export type ApplicationInput = {
  company: string;
  title: string;
  url?: string | null;
  location?: string | null;
  workMode?: string | null;
  jobType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryAsk?: number | null;
  currency?: string | null;
  sourceId?: string | null;
  referrer?: string | null;
  excitement?: number | null;
  stageId?: string | null;
  appliedAt?: number | null; // epoch ms
  notes?: string | null;
  jdText?: string | null;
  tagIds?: string[];
};

export async function createApplication(input: ApplicationInput) {
  const [row] = await db
    .insert(applications)
    .values({
      company: input.company,
      title: input.title,
      url: input.url || null,
      location: input.location || null,
      workMode: input.workMode || null,
      jobType: input.jobType || null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      salaryAsk: input.salaryAsk ?? null,
      currency: input.currency || "USD",
      sourceId: input.sourceId || null,
      referrer: input.referrer || null,
      excitement: input.excitement ?? null,
      stageId: input.stageId || null,
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
      notes: input.notes || null,
      jdText: input.jdText || null,
    })
    .returning();

  if (input.tagIds?.length) {
    await db
      .insert(applicationTags)
      .values(input.tagIds.map((tagId) => ({ applicationId: row.id, tagId })));
  }
  await logActivity(row.id, "created", `Added ${row.title} at ${row.company}`, {
    to: row.stageId,
  });
  revalidate();
  return row.id;
}

export async function updateApplication(id: string, patch: Partial<ApplicationInput>) {
  const { tagIds, appliedAt, ...rest } = patch;
  await db
    .update(applications)
    .set({
      ...rest,
      ...(appliedAt !== undefined ? { appliedAt: appliedAt ? new Date(appliedAt) : null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id));

  if (tagIds) {
    await db.delete(applicationTags).where(eq(applicationTags.applicationId, id));
    if (tagIds.length) {
      await db
        .insert(applicationTags)
        .values(tagIds.map((tagId) => ({ applicationId: id, tagId })));
    }
  }
  revalidate();
}

export async function moveStage(id: string, toStageId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app || app.stageId === toStageId) return;
  const allStages = await db.select().from(stages);
  const from = allStages.find((s) => s.id === app.stageId);
  const to = allStages.find((s) => s.id === toStageId);
  await db
    .update(applications)
    .set({ stageId: toStageId, updatedAt: new Date() })
    .where(eq(applications.id, id));
  await logActivity(
    id,
    "stage_change",
    `${app.company}: ${from?.name ?? "—"} → ${to?.name ?? "—"}`,
    { from: app.stageId, to: toStageId }
  );
  // v3 stop rules: interviewing or terminal stage cancels pending outreach
  if (to && (to.isTerminal || /interview/i.test(to.name))) {
    const { stopCampaignForApplication } = await import("@/lib/outreach");
    await stopCampaignForApplication(id, to.isTerminal ? `application reached ${to.name}` : "you're interviewing — no more cold outreach needed");
  }
  revalidate();
  return { fromStageId: app.stageId };
}

export async function generatePrep(id: string): Promise<{ ok?: true; error?: string }> {
  const { generatePrepPack } = await import("@/lib/prep");
  const res = await generatePrepPack(id);
  revalidate();
  return res;
}

export async function setExcitement(id: string, excitement: number | null) {
  await db
    .update(applications)
    .set({ excitement, updatedAt: new Date() })
    .where(eq(applications.id, id));
  revalidate();
}

export async function setArchived(id: string, archived: boolean) {
  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return;
  await db
    .update(applications)
    .set({ archived, updatedAt: new Date() })
    .where(eq(applications.id, id));
  if (archived) await logActivity(id, "archived", `Archived ${app.company} — ${app.title}`);
  revalidate();
}

export async function deleteApplication(id: string) {
  await db.delete(applications).where(eq(applications.id, id));
  revalidate();
}

export async function logFollowUp(id: string, note?: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return;
  await logActivity(id, "follow_up", note || `Followed up with ${app.company}`);
  revalidate();
}

export async function addNote(id: string, note: string) {
  await logActivity(id, "note", note);
  revalidate();
}
