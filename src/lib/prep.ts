import "server-only";
import { db, applications, interviews, activities, tasks, stages } from "@/db";
import { eq } from "drizzle-orm";
import { getSettings } from "./settings";
import { llm, hasAiKey } from "./llm";

/** Generate (or regenerate) the AI interview prep pack for an application. */
export async function generatePrepPack(applicationId: string): Promise<{ ok?: true; error?: string }> {
  if (!(await hasAiKey())) return { error: "Add an AI key in Settings first." };
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app) return { error: "Application not found." };

  const s = await getSettings();
  const rounds = await db.select().from(interviews).where(eq(interviews.applicationId, applicationId));
  const upcoming = rounds
    .filter((r) => r.scheduledAt && r.scheduledAt.getTime() > Date.now() && r.outcome === "pending")
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())[0];

  try {
    const pack = await llm(
      `Create a focused interview prep pack for this candidate. Be specific and practical — no generic advice.

Role: ${app.title} at ${app.company}${app.location ? ` (${app.location})` : ""}
${upcoming ? `Next round: ${upcoming.round}${upcoming.format ? ` (${upcoming.format})` : ""}${upcoming.interviewers ? ` with ${upcoming.interviewers}` : ""}` : ""}
${app.jdText ? `Job description:\n${app.jdText.slice(0, 2500)}` : ""}
${app.notes ? `Candidate's own notes: ${app.notes.slice(0, 500)}` : ""}

Candidate:
${s.profileBlurb ? `About: ${s.profileBlurb}` : ""}
${s.proofPoints ? `Proof points:\n${s.proofPoints}` : ""}
${s.resumeText ? `Resume excerpt:\n${s.resumeText.slice(0, 1500)}` : ""}

Write these sections (plain text, use SECTION HEADINGS IN CAPS, hyphens for bullets, no markdown symbols like # or **):

COMPANY & ROLE BRIEF — what ${app.company} does, what this team likely owns, why this role exists. 3-4 bullets.
LIKELY QUESTIONS — 6-8 questions this specific interview will probably include, derived from the job description${upcoming ? " and the round type" : ""}.
YOUR STORIES — map the candidate's proof points/resume to the questions above: for each of 3-4 questions, which experience to lead with and the key detail to mention.
QUESTIONS TO ASK — 4 sharp questions that show product/technical thinking about ${app.company} specifically.
RED FLAGS TO AVOID — 2-3 things NOT to say given this role.`
    );
    if (!pack || pack.trim().length < 100) return { error: "AI returned an empty pack — try again." };

    await db.update(applications).set({ prepPack: pack.trim() }).where(eq(applications.id, applicationId));
    await db.insert(activities).values({
      applicationId, type: "note",
      message: `🎯 Interview prep pack generated for ${app.company}`,
    });

    // remind the candidate to review it the day before the round (or tomorrow)
    const due = upcoming?.scheduledAt
      ? new Date(upcoming.scheduledAt.getTime() - 86400000)
      : new Date(Date.now() + 86400000);
    const existing = await db.select().from(tasks).where(eq(tasks.applicationId, applicationId));
    if (!existing.some((t) => !t.completedAt && t.title.startsWith("Review prep pack"))) {
      await db.insert(tasks).values({
        applicationId,
        title: `Review prep pack — ${app.company}`,
        dueAt: due.getTime() > Date.now() ? due : new Date(Date.now() + 3600000),
      });
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed" };
  }
}

/** Autopilot: generate a missing prep pack for one interviewing-stage application per tick. */
export async function autoPrepTick(): Promise<number> {
  if (!(await hasAiKey())) return 0;
  const [allApps, allStages] = await Promise.all([
    db.select().from(applications),
    db.select().from(stages),
  ]);
  const interviewStages = new Set(
    allStages.filter((st) => /interview/i.test(st.name)).map((st) => st.id)
  );
  const candidate = allApps.find(
    (a) => !a.archived && !a.prepPack && a.stageId && interviewStages.has(a.stageId)
  );
  if (!candidate) return 0;
  const res = await generatePrepPack(candidate.id);
  return res.ok ? 1 : 0;
}
