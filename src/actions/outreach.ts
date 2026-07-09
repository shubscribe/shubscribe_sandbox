"use server";

import { db, campaigns, leads, outreachMessages, sequenceSteps, resumes } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { runTick, ensureSequenceSeeded, createCampaign, type TickReport } from "@/lib/outreach";
import { setSettings } from "@/lib/settings";

function revalidate() {
  revalidatePath("/", "layout");
}

/* ---------- message queue ---------- */

export async function updateMessage(id: string, patch: { subject?: string | null; body?: string }) {
  await db.update(outreachMessages).set(patch).where(eq(outreachMessages.id, id));
  revalidate();
}

export async function approveMessage(id: string) {
  await db.update(outreachMessages).set({ status: "approved" }).where(
    and(eq(outreachMessages.id, id), eq(outreachMessages.status, "drafted"))
  );
  revalidate();
}

export async function skipMessage(id: string) {
  await db.update(outreachMessages).set({ status: "skipped" }).where(eq(outreachMessages.id, id));
  revalidate();
}

export async function approveAllForCampaign(campaignId: string) {
  const campaignLeads = await db.select().from(leads).where(eq(leads.campaignId, campaignId));
  if (!campaignLeads.length) return;
  await db.update(outreachMessages)
    .set({ status: "approved" })
    .where(and(
      inArray(outreachMessages.leadId, campaignLeads.map((l) => l.id)),
      eq(outreachMessages.status, "drafted")
    ));
  revalidate();
}

/* ---------- campaigns ---------- */

export async function setCampaignStatus(id: string, status: "active" | "paused" | "stopped") {
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  revalidate();
}

export async function setCampaignResume(id: string, resumeId: string | null) {
  await db.update(campaigns).set({ resumeId }).where(eq(campaigns.id, id));
  revalidate();
}

export async function startCampaignFor(applicationId: string) {
  const res = await createCampaign(applicationId);
  revalidate();
  return res;
}

/* ---------- sequence editor ---------- */

export async function updateStep(id: string, patch: { delayDays?: number; framing?: string; type?: string }) {
  await db.update(sequenceSteps).set(patch).where(eq(sequenceSteps.id, id));
  revalidate();
}

export async function addStep(persona: string, position: number) {
  await db.insert(sequenceSteps).values({
    persona, position, type: "email", delayDays: 3,
    framing: "Short, polite follow-up. Keep it under 80 words.",
  });
  revalidate();
}

export async function deleteStep(id: string) {
  await db.delete(sequenceSteps).where(eq(sequenceSteps.id, id));
  revalidate();
}

export async function resetSequence() {
  await db.delete(sequenceSteps);
  await ensureSequenceSeeded();
  revalidate();
}

/* ---------- resumes ---------- */

export async function uploadResume(formData: FormData): Promise<{ ok?: true; error?: string; parsedChars?: number }> {
  const file = formData.get("file") as File | null;
  const name = String(formData.get("name") || "Resume");
  if (!file) return { error: "No file" };
  if (file.size > 3.5 * 1024 * 1024) return { error: "Keep the file under 3.5 MB" };

  const buf = Buffer.from(await file.arrayBuffer());
  const existing = await db.select().from(resumes);
  const [row] = await db.insert(resumes).values({
    name,
    filename: file.name,
    mime: file.type || "application/pdf",
    data: buf.toString("base64"),
    isDefault: existing.length === 0,
  }).returning();
  void row;

  // best-effort text extraction for AI personalization
  let parsedChars = 0;
  try {
    let text = "";
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default || await import("pdf-parse/lib/pdf-parse.js");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = await (pdfParse as any)(buf);
      text = parsed.text ?? "";
    } else if (/text|markdown/.test(file.type) || /\.(txt|md)$/i.test(file.name)) {
      text = buf.toString("utf8");
    }
    text = text.replace(/\s+/g, " ").trim().slice(0, 6000);
    if (text.length > 100) {
      await setSettings({ resumeText: text });
      parsedChars = text.length;
    }
  } catch {
    // parsing is optional — the attachment still works
  }

  revalidate();
  return { ok: true, parsedChars };
}

export async function setDefaultResume(id: string) {
  const all = await db.select().from(resumes);
  for (const r of all) {
    await db.update(resumes).set({ isDefault: r.id === id }).where(eq(resumes.id, r.id));
  }
  revalidate();
}

export async function deleteResume(id: string) {
  await db.delete(resumes).where(eq(resumes.id, id));
  revalidate();
}

/* ---------- manual tick ---------- */

export async function tickNow(): Promise<TickReport> {
  const report = await runTick();
  revalidate();
  return report;
}
