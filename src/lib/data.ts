import "server-only";
import { db, applications, stages, sources, tags, applicationTags, interviews, tasks, contacts, applicationContacts, activities } from "@/db";
import { asc, desc, eq, and, gte, isNull, inArray } from "drizzle-orm";
import { getSettings } from "./settings";

export type Stage = typeof stages.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Activity = typeof activities.$inferSelect;

export type AppListItem = Application & {
  stage: Stage | null;
  source: Source | null;
  tags: Tag[];
  openTasks: number;
  nextInterview: Interview | null;
};

export type AppFull = AppListItem & {
  interviews: Interview[];
  taskList: Task[];
  contacts: Contact[];
  activities: Activity[];
};

export async function getStages() {
  return db.select().from(stages).orderBy(asc(stages.position));
}

export async function getSources() {
  return db.select().from(sources).orderBy(asc(sources.name));
}

export async function getTags() {
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function getApplications(opts?: { includeArchived?: boolean }): Promise<AppListItem[]> {
  const rows = await db
    .select()
    .from(applications)
    .where(opts?.includeArchived ? undefined : eq(applications.archived, false))
    .orderBy(desc(applications.lastActivityAt));

  const [allStages, allSources, allTags, tagLinks, openTaskRows, upcoming] = await Promise.all([
    getStages(),
    getSources(),
    getTags(),
    db.select().from(applicationTags),
    db.select().from(tasks).where(isNull(tasks.completedAt)),
    db
      .select()
      .from(interviews)
      .where(gte(interviews.scheduledAt, new Date()))
      .orderBy(asc(interviews.scheduledAt)),
  ]);

  const stageMap = new Map(allStages.map((s) => [s.id, s]));
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));
  const tagMap = new Map(allTags.map((t) => [t.id, t]));

  return rows.map((a) => ({
    ...a,
    stage: a.stageId ? (stageMap.get(a.stageId) ?? null) : null,
    source: a.sourceId ? (sourceMap.get(a.sourceId) ?? null) : null,
    tags: tagLinks
      .filter((l) => l.applicationId === a.id)
      .map((l) => tagMap.get(l.tagId))
      .filter((t): t is Tag => !!t),
    openTasks: openTaskRows.filter((t) => t.applicationId === a.id).length,
    nextInterview: upcoming.find((i) => i.applicationId === a.id) ?? null,
  }));
}

export async function getApplication(id: string): Promise<AppFull | null> {
  const [row] = await db.select().from(applications).where(eq(applications.id, id));
  if (!row) return null;

  const [allStages, allSources, allTags, tagLinks, ivs, taskList, contactLinks, acts] =
    await Promise.all([
      getStages(),
      getSources(),
      getTags(),
      db.select().from(applicationTags).where(eq(applicationTags.applicationId, id)),
      db.select().from(interviews).where(eq(interviews.applicationId, id)).orderBy(desc(interviews.scheduledAt)),
      db.select().from(tasks).where(eq(tasks.applicationId, id)).orderBy(asc(tasks.dueAt)),
      db.select().from(applicationContacts).where(eq(applicationContacts.applicationId, id)),
      db.select().from(activities).where(eq(activities.applicationId, id)).orderBy(desc(activities.createdAt)),
    ]);

  const linkedContacts = contactLinks.length
    ? await db.select().from(contacts).where(inArray(contacts.id, contactLinks.map((l) => l.contactId)))
    : [];

  const tagMap = new Map(allTags.map((t) => [t.id, t]));
  const upcoming = ivs
    .filter((i) => i.scheduledAt && i.scheduledAt.getTime() > Date.now())
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());

  return {
    ...row,
    stage: allStages.find((s) => s.id === row.stageId) ?? null,
    source: allSources.find((s) => s.id === row.sourceId) ?? null,
    tags: tagLinks.map((l) => tagMap.get(l.tagId)).filter((t): t is Tag => !!t),
    openTasks: taskList.filter((t) => !t.completedAt).length,
    nextInterview: upcoming[0] ?? null,
    interviews: ivs,
    taskList,
    contacts: linkedContacts,
    activities: acts,
  };
}

export type DashboardData = {
  upcomingInterviews: (Interview & { app: Application | null })[];
  dueTasks: (Task & { app: Application | null })[];
  staleApps: AppListItem[];
  stats: {
    active: number;
    interviewsScheduled: number;
    offers: number;
    responseRate: number; // % of non-first-stage among non-archived with appliedAt
    appliedThisWeek: number;
    weeklyGoal: number;
  };
  funnel: { stage: Stage; count: number }[];
  feed: (Activity & { app: Application | null })[];
  staleDays: number;
};

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export async function getDashboardData(): Promise<DashboardData> {
  const s = await getSettings();
  const apps = await getApplications();
  const allStages = await getStages();
  const appMap = new Map<string, Application>(apps.map((a) => [a.id, a]));

  const weekAhead = new Date(Date.now() + 7 * 86400000);
  const upcomingInterviews = (
    await db
      .select()
      .from(interviews)
      .where(and(gte(interviews.scheduledAt, new Date())))
      .orderBy(asc(interviews.scheduledAt))
  )
    .filter((i) => i.scheduledAt && i.scheduledAt <= weekAhead)
    .map((i) => ({ ...i, app: appMap.get(i.applicationId) ?? null }));

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const dueTasks = (
    await db.select().from(tasks).where(isNull(tasks.completedAt)).orderBy(asc(tasks.dueAt))
  )
    .filter((t) => t.dueAt && t.dueAt <= endOfToday)
    .map((t) => ({ ...t, app: t.applicationId ? (appMap.get(t.applicationId) ?? null) : null }));

  const staleCutoff = Date.now() - s.staleDays * 86400000;
  const staleApps = apps.filter(
    (a) =>
      !a.stage?.isTerminal &&
      a.appliedAt != null &&
      (a.lastActivityAt?.getTime() ?? 0) < staleCutoff
  );

  const active = apps.filter((a) => !a.stage?.isTerminal).length;
  const offerStageIds = allStages.filter((st) => /offer/i.test(st.name)).map((st) => st.id);
  const offers = apps.filter((a) => a.stageId && offerStageIds.includes(a.stageId)).length;
  // response = moved beyond the first non-terminal stage after applying
  const earlyStageIds = allStages.filter((st) => !st.isTerminal).slice(0, 2).map((st) => st.id);
  const appliedApps = apps.filter((a) => a.appliedAt != null);
  const respondedCount = appliedApps.filter(
    (a) => a.stageId && !earlyStageIds.includes(a.stageId)
  ).length;
  const responseRate = appliedApps.length
    ? Math.round((respondedCount / appliedApps.length) * 100)
    : 0;

  const weekStart = startOfWeek();
  const appliedThisWeek = apps.filter((a) => a.appliedAt && a.appliedAt >= weekStart).length;

  const funnel = allStages.map((stage) => ({
    stage,
    count: apps.filter((a) => a.stageId === stage.id).length,
  }));

  const feed = (
    await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(20)
  ).map((act) => ({
    ...act,
    app: act.applicationId ? (appMap.get(act.applicationId) ?? null) : null,
  }));

  return {
    upcomingInterviews,
    dueTasks,
    staleApps,
    stats: {
      active,
      interviewsScheduled: upcomingInterviews.length,
      offers,
      responseRate,
      appliedThisWeek,
      weeklyGoal: s.weeklyGoal,
    },
    funnel,
    feed,
    staleDays: s.staleDays,
  };
}
