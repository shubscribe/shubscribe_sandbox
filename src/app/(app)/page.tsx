import Link from "next/link";
import { getDashboardData } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { db, suggestions, applications, stages } from "@/db";
import { eq } from "drizzle-orm";
import { DueTaskList, StaleList } from "@/components/dashboard/ActionLists";
import { SuggestionList } from "@/components/dashboard/SuggestionList";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const [data, settings, pendingSuggestions, allApps, allStages] = await Promise.all([
    getDashboardData(),
    getSettings(),
    db.select().from(suggestions).where(eq(suggestions.status, "pending")),
    db.select({ id: applications.id, company: applications.company }).from(applications),
    db.select().from(stages),
  ]);
  const suggestionItems = pendingSuggestions.map((sg) => ({
    id: sg.id,
    kind: sg.kind,
    subject: sg.subject,
    fromAddr: sg.fromAddr,
    snippet: sg.snippet,
    app: sg.applicationId ? (allApps.find((a) => a.id === sg.applicationId) ?? null) : null,
    proposedStageName: sg.proposedStageId
      ? (allStages.find((st) => st.id === sg.proposedStageId)?.name ?? null)
      : null,
    proposedTask: sg.proposedTask,
  }));
  const { stats } = data;
  const goalPct = Math.min(100, Math.round((stats.appliedThisWeek / Math.max(1, stats.weeklyGoal)) * 100));
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  const tiles = [
    { label: "Active applications", value: stats.active },
    { label: "Interviews · next 7d", value: stats.interviewsScheduled },
    { label: "Offers", value: stats.offers },
    { label: "Response rate", value: `${stats.responseRate}%` },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting()}{settings.name ? `, ${settings.name.split(" ")[0]}` : ""} 👋
          </h1>
          {settings.targetRole && (
            <p className="text-sm text-ink-dim">Hunting: {settings.targetRole}</p>
          )}
        </div>
        <p className="text-xs text-ink-faint">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <SuggestionList items={suggestionItems} />

      {/* stat tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="glass p-4">
            <div className="num text-2xl font-semibold">{t.value}</div>
            <div className="mt-0.5 text-xs text-ink-dim">{t.label}</div>
          </div>
        ))}
      </div>

      {/* weekly goal */}
      <div className="glass mb-5 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium">This week&apos;s applications</span>
          <span className="num text-sm">
            <span className="font-semibold">{stats.appliedThisWeek}</span>
            <span className="text-ink-faint"> / {stats.weeklyGoal} goal</span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${goalPct}%` }}
          />
        </div>
        {goalPct >= 100 ? (
          <p className="mt-1.5 text-xs text-good">Goal hit — momentum looks great. 🎉</p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-faint">
            {stats.weeklyGoal - stats.appliedThisWeek} more to hit your weekly goal.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* left column: action center */}
        <div className="space-y-5">
          <section className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">🎙 Upcoming interviews</h2>
            {data.upcomingInterviews.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing scheduled in the next 7 days.</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingInterviews.map((iv) => (
                  <Link
                    key={iv.id}
                    href={`/applications/${iv.applicationId}`}
                    className="glass flex items-center gap-3 p-2.5 transition hover:-translate-y-0.5"
                  >
                    <div className="num w-24 shrink-0 text-xs text-accent">
                      {iv.scheduledAt?.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {iv.app?.company ?? "—"} · {iv.round}
                      </div>
                      <div className="truncate text-xs text-ink-faint">
                        {[iv.format, iv.interviewers].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">☑ Due today</h2>
            <DueTaskList tasks={data.dueTasks.map((t) => ({
              id: t.id,
              title: t.title,
              dueAt: t.dueAt?.getTime() ?? null,
              app: t.app ? { id: t.app.id, company: t.app.company } : null,
            }))} />
          </section>

          <section className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">
              ⚠ Needs attention
              <span className="ml-2 text-xs font-normal text-ink-faint">
                quiet for {data.staleDays}+ days
              </span>
            </h2>
            <StaleList apps={data.staleApps.map((a) => ({
              id: a.id,
              company: a.company,
              title: a.title,
              stageName: a.stage?.name ?? "—",
              stageColor: a.stage?.color ?? "#888",
              lastActivity: a.lastActivityAt?.getTime() ?? null,
            }))} />
          </section>
        </div>

        {/* right column: pipeline + feed */}
        <div className="space-y-5">
          <section className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">Pipeline funnel</h2>
            <div className="space-y-2">
              {data.funnel.map(({ stage, count }) => (
                <Link key={stage.id} href="/applications" className="group block">
                  <div className="mb-0.5 flex items-baseline justify-between text-xs">
                    <span className="text-ink-dim group-hover:text-ink">{stage.name}</span>
                    <span className="num text-ink">{count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-[4px] bg-line/60">
                    <div
                      className="h-full rounded-[4px] transition-all"
                      style={{
                        width: `${Math.max(count > 0 ? 4 : 0, (count / maxFunnel) * 100)}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
            {data.feed.length === 0 ? (
              <p className="text-xs text-ink-faint">
                Activity will show up here as you add applications and move them along.
              </p>
            ) : (
              <div className="space-y-2">
                {data.feed.map((act) => (
                  <div key={act.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    <span className="flex-1 text-ink-dim">
                      {act.app ? (
                        <Link href={`/applications/${act.app.id}`} className="hover:text-accent">
                          {act.message}
                        </Link>
                      ) : (
                        act.message
                      )}
                    </span>
                    <span className="num shrink-0 text-ink-faint">
                      {act.createdAt ? timeAgoShort(act.createdAt) : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function timeAgoShort(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
