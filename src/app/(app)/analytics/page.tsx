import { db, activities, applications, sources, interviews, campaigns, leads } from "@/db";
import { getStages } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default async function AnalyticsPage() {
  const [apps, stages, acts, settings, allSources, allInterviews, allCampaigns, allLeads] = await Promise.all([
    db.select().from(applications),
    getStages(),
    db.select().from(activities),
    getSettings(),
    db.select().from(sources),
    db.select().from(interviews),
    db.select().from(campaigns),
    db.select().from(leads),
  ]);

  /* ---- applications per week (last 12 weeks) ---- */
  const weeks: { label: string; count: number }[] = [];
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  for (let i = 11; i >= 0; i--) {
    const start = new Date(monday.getTime() - i * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    weeks.push({
      label: start.toLocaleDateString([], { month: "short", day: "numeric" }),
      count: apps.filter((a) => a.appliedAt && a.appliedAt >= start && a.appliedAt < end).length,
    });
  }

  /* ---- stage timelines from activity meta ---- */
  type Move = { appId: string; time: number; from: string | null; to: string | null };
  const moves: Move[] = [];
  for (const act of acts) {
    if (!act.applicationId || !act.createdAt) continue;
    if (act.type !== "created" && act.type !== "stage_change") continue;
    let meta: { from?: string | null; to?: string | null } = {};
    try { meta = act.meta ? JSON.parse(act.meta) : {}; } catch { /* ignore */ }
    moves.push({
      appId: act.applicationId,
      time: act.createdAt.getTime(),
      from: act.type === "created" ? null : (meta.from ?? null),
      to: meta.to ?? null,
    });
  }
  moves.sort((a, b) => a.time - b.time);

  // durations per stage (completed stays only)
  const durations = new Map<string, number[]>();
  const entered = new Map<string, { stage: string; time: number }>(); // per app
  for (const m of moves) {
    const prev = entered.get(m.appId);
    if (prev && (m.from === prev.stage || m.from === null)) {
      const days = (m.time - prev.time) / 86400000;
      if (m.from && days >= 0) {
        durations.set(m.from, [...(durations.get(m.from) ?? []), days]);
      }
    }
    if (m.to) entered.set(m.appId, { stage: m.to, time: m.time });
  }
  const velocity = stages.map((s) => ({
    name: s.name,
    color: s.color,
    medianDays: Math.round(median(durations.get(s.id) ?? []) * 10) / 10,
    samples: (durations.get(s.id) ?? []).length,
  }));

  /* ---- sankey flows ---- */
  const flowCounts = new Map<string, number>();
  for (const m of moves) {
    const from = m.from ?? "__added__";
    if (!m.to || from === m.to) continue;
    const key = `${from}→${m.to}`;
    flowCounts.set(key, (flowCounts.get(key) ?? 0) + 1);
  }
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const sankeyLinks = [...flowCounts.entries()]
    .map(([key, value]) => {
      const [from, to] = key.split("→");
      return {
        source: from === "__added__" ? "Added" : (stageMap.get(from)?.name ?? null),
        sourceColor: from === "__added__" ? "#8b8bf5" : (stageMap.get(from)?.color ?? "#888"),
        target: stageMap.get(to)?.name ?? null,
        targetColor: stageMap.get(to)?.color ?? "#888",
        value,
      };
    })
    .filter((l): l is typeof l & { source: string; target: string } => !!l.source && !!l.target);

  /* ---- v4: which sources actually convert to interviews ---- */
  const interviewedAppIds = new Set(allInterviews.map((iv) => iv.applicationId));
  const sourceStats = allSources
    .map((src) => {
      const srcApps = apps.filter((a) => a.sourceId === src.id);
      const interviewed = srcApps.filter((a) => interviewedAppIds.has(a.id)).length;
      return {
        name: src.name,
        color: src.color,
        apps: srcApps.length,
        interviewed,
        rate: srcApps.length ? Math.round((interviewed / srcApps.length) * 100) : 0,
      };
    })
    .filter((x) => x.apps > 0)
    .sort((a, b) => b.rate - a.rate || b.apps - a.apps);

  /* ---- v4: does outreach move the needle? ---- */
  const repliedCampaignAppIds = new Set(
    allLeads
      .filter((l) => l.status === "replied")
      .map((l) => allCampaigns.find((c) => c.id === l.campaignId)?.applicationId)
      .filter((x): x is string => !!x)
  );
  const campaignAppIds = new Set(allCampaigns.map((c) => c.applicationId));
  const outreachImpact = {
    withCampaign: campaignAppIds.size,
    gotReply: repliedCampaignAppIds.size,
    replyToInterview: [...repliedCampaignAppIds].filter((id) => interviewedAppIds.has(id)).length,
  };

  return (
    <AnalyticsView
      weeks={weeks}
      weeklyGoal={settings.weeklyGoal}
      velocity={velocity}
      sankeyLinks={sankeyLinks}
      totalApps={apps.length}
      sourceStats={sourceStats}
      outreachImpact={outreachImpact}
    />
  );
}
