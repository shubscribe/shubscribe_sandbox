"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { sankey, sankeyLinkHorizontal, type SankeyNode } from "d3-sankey";

type Week = { label: string; count: number };
type Velocity = { name: string; color: string; medianDays: number; samples: number };
type Flow = { source: string; sourceColor: string; target: string; targetColor: string; value: number };
type SourceStat = { name: string; color: string; apps: number; interviewed: number; rate: number };
type OutreachImpact = { withCampaign: number; gotReply: number; replyToInterview: number };

function GlassTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-raised px-3 py-2 text-xs">
      <div className="text-ink-faint">week of {label}</div>
      <div className="num font-semibold text-ink">{payload[0].value} applications</div>
    </div>
  );
}

export function AnalyticsView({
  weeks, weeklyGoal, velocity, sankeyLinks, totalApps, sourceStats = [], outreachImpact,
}: {
  weeks: Week[];
  weeklyGoal: number;
  velocity: Velocity[];
  sankeyLinks: Flow[];
  totalApps: number;
  sourceStats?: SourceStat[];
  outreachImpact?: OutreachImpact;
}) {
  const maxVelocity = Math.max(1, ...velocity.map((v) => v.medianDays));

  if (totalApps === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-xl font-semibold tracking-tight">Analytics</h1>
        <div className="glass p-12 text-center">
          <div className="mb-2 text-3xl">📈</div>
          <p className="text-sm text-ink-dim">
            Charts light up once you have applications in the pipeline. Add a few and
            check back.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>

      {/* applications per week */}
      <section className="glass p-5">
        <h2 className="mb-1 text-sm font-semibold">Applications per week</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Last 12 weeks · dashed line is your goal of {weeklyGoal}/week
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--ink-faint)", fontSize: 10 }}
                axisLine={{ stroke: "var(--line)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--ink-faint)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<GlassTooltip />} cursor={{ fill: "var(--accent-soft)" }} />
              <ReferenceLine
                y={weeklyGoal}
                stroke="var(--ink-faint)"
                strokeDasharray="4 4"
                label={{ value: "goal", position: "right", fill: "var(--ink-faint)", fontSize: 10 }}
              />
              <Bar
                dataKey="count"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* stage velocity */}
      <section className="glass p-5">
        <h2 className="mb-1 text-sm font-semibold">Stage velocity</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Median days an application spends in each stage before moving on
        </p>
        {velocity.every((v) => v.samples === 0) ? (
          <p className="text-xs text-ink-faint">
            Move applications between stages and velocity will appear here.
          </p>
        ) : (
          <div className="space-y-2.5">
            {velocity.filter((v) => v.samples > 0).map((v) => (
              <div key={v.name} title={`${v.name}: median ${v.medianDays}d over ${v.samples} move(s)`}>
                <div className="mb-0.5 flex items-baseline justify-between text-xs">
                  <span className="text-ink-dim">{v.name}</span>
                  <span className="num text-ink">
                    {v.medianDays}d <span className="text-ink-faint">· {v.samples} moves</span>
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-[4px] bg-line/60">
                  <div
                    className="h-full rounded-[4px]"
                    style={{
                      width: `${Math.max(3, (v.medianDays / maxVelocity) * 100)}%`,
                      backgroundColor: v.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* v4: source → interview conversion */}
      {sourceStats.length > 0 && (
        <section className="glass p-5">
          <h2 className="mb-1 text-sm font-semibold">Which sources get you interviews</h2>
          <p className="mb-4 text-xs text-ink-faint">
            Conversion from application to at least one interview, per source
          </p>
          <div className="space-y-2.5">
            {sourceStats.map((src) => (
              <div key={src.name} title={`${src.interviewed} of ${src.apps} applications reached an interview`}>
                <div className="mb-0.5 flex items-baseline justify-between text-xs">
                  <span className="text-ink-dim">{src.name}</span>
                  <span className="num text-ink">
                    {src.rate}% <span className="text-ink-faint">· {src.interviewed}/{src.apps}</span>
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-[4px] bg-line/60">
                  <div
                    className="h-full rounded-[4px]"
                    style={{ width: `${Math.max(src.rate > 0 ? 4 : 0, src.rate)}%`, backgroundColor: src.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Double down on the sources at the top — they earn interviews, not just applications.
          </p>
        </section>
      )}

      {/* v4: outreach impact */}
      {outreachImpact && outreachImpact.withCampaign > 0 && (
        <section className="glass p-5">
          <h2 className="mb-1 text-sm font-semibold">Does outreach move the needle?</h2>
          <p className="mb-4 text-xs text-ink-faint">The campaign funnel, end to end</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass p-3 text-center">
              <div className="num text-2xl font-semibold">{outreachImpact.withCampaign}</div>
              <div className="mt-0.5 text-xs text-ink-dim">apps with campaigns</div>
            </div>
            <div className="glass p-3 text-center">
              <div className="num text-2xl font-semibold">{outreachImpact.gotReply}</div>
              <div className="mt-0.5 text-xs text-ink-dim">got a reply</div>
            </div>
            <div className="glass p-3 text-center">
              <div className="num text-2xl font-semibold">{outreachImpact.replyToInterview}</div>
              <div className="mt-0.5 text-xs text-ink-dim">reply → interview</div>
            </div>
          </div>
        </section>
      )}

      {/* sankey */}
      <section className="glass p-5">
        <h2 className="mb-1 text-sm font-semibold">Where applications flow</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Every stage move, from first add to final outcome
        </p>
        {sankeyLinks.length === 0 ? (
          <p className="text-xs text-ink-faint">
            Flows appear once applications start moving between stages.
          </p>
        ) : (
          <SankeyChart links={sankeyLinks} />
        )}
      </section>
    </div>
  );
}

type NodeDatum = { name: string; color: string };
type LinkDatum = { source: number; target: number; value: number; sourceColor: string };

function SankeyChart({ links }: { links: Flow[] }) {
  const W = 720;
  const H = 340;

  const layout = useMemo(() => {
    const names = [...new Set(links.flatMap((l) => [l.source, l.target]))];
    const colorOf = new Map<string, string>();
    for (const l of links) {
      colorOf.set(l.source, l.sourceColor);
      if (!colorOf.has(l.target)) colorOf.set(l.target, l.targetColor);
    }
    const nodes: NodeDatum[] = names.map((name) => ({ name, color: colorOf.get(name) ?? "#888" }));
    const linkData: LinkDatum[] = links.map((l) => ({
      source: names.indexOf(l.source),
      target: names.indexOf(l.target),
      value: l.value,
      sourceColor: l.sourceColor,
    }));

    try {
      const gen = sankey<NodeDatum, LinkDatum>()
        .nodeWidth(10)
        .nodePadding(18)
        .extent([[0, 8], [W, H - 8]]);
      return gen({
        nodes: nodes.map((n) => ({ ...n })),
        links: linkData.map((l) => ({ ...l })),
      });
    } catch {
      return null; // circular flows can defeat the layout; fail soft
    }
  }, [links]);

  if (!layout) {
    return (
      <p className="text-xs text-ink-faint">
        Your stage flows contain loops (back-and-forth moves) that can&apos;t be drawn as
        a sankey — the velocity chart above still covers them.
      </p>
    );
  }

  const path = sankeyLinkHorizontal();

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px]" role="img" aria-label="Sankey diagram of application stage flows">
        {layout.links.map((l, i) => (
          <path
            key={i}
            d={path(l) ?? undefined}
            fill="none"
            stroke={(l as unknown as LinkDatum).sourceColor}
            strokeOpacity={0.3}
            strokeWidth={Math.max(1.5, l.width ?? 1)}
          >
            <title>
              {(l.source as SankeyNode<NodeDatum, LinkDatum>).name} → {(l.target as SankeyNode<NodeDatum, LinkDatum>).name}: {l.value}
            </title>
          </path>
        ))}
        {layout.nodes.map((n, i) => {
          const node = n as SankeyNode<NodeDatum, LinkDatum> & NodeDatum;
          const x0 = node.x0 ?? 0, x1 = node.x1 ?? 0, y0 = node.y0 ?? 0, y1 = node.y1 ?? 0;
          const leftHalf = x0 < W / 2;
          const total = (node.value ?? 0);
          return (
            <g key={i}>
              <rect x={x0} y={y0} width={x1 - x0} height={Math.max(2, y1 - y0)} rx={3} fill={node.color}>
                <title>{node.name}: {total}</title>
              </rect>
              <text
                x={leftHalf ? x1 + 6 : x0 - 6}
                y={(y0 + y1) / 2}
                dominantBaseline="middle"
                textAnchor={leftHalf ? "start" : "end"}
                fontSize={11}
                fontWeight={500}
                fill="var(--ink)"
                stroke="var(--bg)"
                strokeWidth={3}
                style={{ paintOrder: "stroke" }}
              >
                {node.name} <tspan fill="var(--ink-faint)">({total})</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
