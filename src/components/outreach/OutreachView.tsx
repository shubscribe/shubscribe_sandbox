"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Chip, inputCls, btnPrimary, btnGhost } from "@/components/ui/bits";
import {
  updateMessage, approveMessage, skipMessage, approveAllForCampaign,
  setCampaignStatus, setCampaignResume, tickNow,
} from "@/actions/outreach";
import { cn } from "@/lib/utils";

type Msg = {
  id: string; stepPosition: number; type: string; subject: string | null; body: string;
  status: string; sentAt: number | null; gmailThreadId: string | null;
  persona: string; leadStatus: string; campaignId: string | null;
  contact: { name: string; title: string | null; email: string | null } | null;
  company: string; appId: string | null; appTitle: string;
};
type BoardItem = {
  id: string; status: string; resumeId: string | null;
  company: string; title: string; appId: string | null;
  leads: { id: string; persona: string; status: string; contact: string; sent: number; pending: number }[];
  replied: number;
};
type Analytics = {
  sent: number; dmTasks: number; replied: number; replyRate: number;
  byPersona: { persona: string; contacted: number; replied: number }[];
};

const PERSONA_ICON: Record<string, string> = { recruiter: "🎯", manager: "👔", peer: "🤝" };
const TABS = ["Queue", "Campaigns", "Analytics", "History"] as const;

export function OutreachView({
  queue, approvedCount, board, history, analytics, resumes, settings,
}: {
  queue: Msg[];
  approvedCount: number;
  board: BoardItem[];
  history: Msg[];
  analytics: Analytics;
  resumes: { id: string; name: string; isDefault: boolean }[];
  settings: { paused: boolean; cap: number; windowStart: number; windowEnd: number; gmailConnected: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Queue");
  const [editing, setEditing] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);

  async function runTickNow() {
    setTicking(true);
    try {
      const r = await tickNow();
      toast.success(
        r.skipped
          ? `Tick ran — ${r.skipped}`
          : `Tick ran — ${r.sent} email(s) sent, ${r.dmTasks} DM task(s), ${r.drafted} follow-up(s) drafted`
      );
      router.refresh();
    } finally {
      setTicking(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Outreach</h1>
        <div className="glass-pill flex gap-1 p-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("rounded-full px-3 py-1", tab === t ? "bg-accent text-white" : "text-ink-dim hover:text-ink")}
            >
              {t}
              {t === "Queue" && queue.length > 0 && <span className="num ml-1">({queue.length})</span>}
            </button>
          ))}
        </div>
        <button className={cn(btnGhost, "ml-auto")} onClick={runTickNow} disabled={ticking}>
          {ticking ? "Running…" : "⟳ Run tick now"}
        </button>
      </div>

      {settings.paused && (
        <div className="glass mb-4 border-warn/40 p-3 text-xs text-warn">
          ⏸ Outreach is paused (Settings → Outreach automation). Nothing sends until you unpause.
        </div>
      )}
      {!settings.gmailConnected && (
        <div className="glass mb-4 p-3 text-xs text-ink-dim">
          Gmail isn&apos;t connected — approved emails can&apos;t send. Connect it in{" "}
          <Link href="/settings" className="text-accent">Settings</Link>. (If you connected before v3,
          reconnect once to grant the new send permission.)
        </div>
      )}

      {/* ---------------- QUEUE ---------------- */}
      {tab === "Queue" && (
        <div className="space-y-3">
          {approvedCount > 0 && (
            <p className="text-xs text-ink-faint">
              {approvedCount} approved message(s) waiting for the next send slot
              (max {settings.cap}/day, {settings.windowStart}:00–{settings.windowEnd}:00).
            </p>
          )}
          {queue.length === 0 ? (
            <div className="glass p-12 text-center">
              <div className="mb-2 text-3xl">📨</div>
              <p className="text-sm text-ink-dim">
                Nothing waiting for review. Campaigns draft messages automatically when
                high-fit jobs are added — or start one from any application&apos;s page.
              </p>
            </div>
          ) : (
            queue.map((m) => (
              <div key={m.id} className="glass p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span>{PERSONA_ICON[m.persona] ?? "•"}</span>
                  <span className="font-medium">{m.contact?.name ?? "Unknown"}</span>
                  {m.contact?.title && <span className="text-xs text-ink-faint">{m.contact.title}</span>}
                  <Chip>{m.company}</Chip>
                  <Chip>{m.type === "dm_task" ? "LinkedIn DM" : `email · step ${m.stepPosition}`}</Chip>
                  {!m.contact?.email && m.type === "email" && (
                    <span className="text-[11px] text-warn">no email on contact — will be cancelled</span>
                  )}
                  {m.campaignId && (
                    <button
                      className="ml-auto text-[11px] text-accent hover:underline"
                      onClick={async () => {
                        await approveAllForCampaign(m.campaignId!);
                        router.refresh();
                        toast.success(`All drafted messages for ${m.company} approved`);
                      }}
                    >
                      ✓✓ Approve all for {m.company}
                    </button>
                  )}
                </div>

                {editing === m.id ? (
                  <EditBox msg={m} onDone={() => { setEditing(null); router.refresh(); }} />
                ) : (
                  <>
                    {m.subject && <div className="text-sm font-medium">{m.subject}</div>}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{m.body}</p>
                  </>
                )}

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button className={btnGhost} onClick={() => setEditing(editing === m.id ? null : m.id)}>
                    {editing === m.id ? "Close editor" : "✎ Edit"}
                  </button>
                  <button
                    className={btnGhost}
                    onClick={async () => { await skipMessage(m.id); router.refresh(); toast(`Skipped`); }}
                  >
                    Skip
                  </button>
                  <button
                    className={btnPrimary}
                    onClick={async () => {
                      await approveMessage(m.id);
                      router.refresh();
                      toast.success("Approved — it sends in the next slot", {
                        description: m.type === "dm_task" ? "DM steps become a task with the text ready to paste." : undefined,
                      });
                    }}
                  >
                    ✓ Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ---------------- CAMPAIGNS ---------------- */}
      {tab === "Campaigns" && (
        <div className="space-y-3">
          {board.length === 0 ? (
            <div className="glass p-12 text-center text-sm text-ink-dim">
              No campaigns yet — they&apos;re created automatically for high-fit discovered
              jobs (needs Apollo + AI keys), or from an application&apos;s page.
            </div>
          ) : (
            board.map((c) => (
              <div key={c.id} className="glass p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.company}</span>
                  <span className="text-sm text-ink-dim">{c.title}</span>
                  <Chip color={c.status === "active" ? "#2fbfa4" : c.status === "paused" ? "#e09b3d" : "#7d87b0"}>
                    {c.status}
                  </Chip>
                  {c.replied > 0 && <Chip color="#2fbfa4">{c.replied} replied 🎉</Chip>}
                  <div className="ml-auto flex items-center gap-2">
                    <select
                      className={cn(inputCls, "!w-40 !py-1 text-xs")}
                      value={c.resumeId ?? ""}
                      onChange={async (e) => {
                        await setCampaignResume(c.id, e.target.value || null);
                        router.refresh();
                        toast.success("Campaign resume updated");
                      }}
                      title="Resume attached to first emails"
                    >
                      <option value="">Default resume</option>
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    {c.status === "active" ? (
                      <button className={cn(btnGhost, "!px-2 !py-1 text-xs")} onClick={async () => { await setCampaignStatus(c.id, "paused"); router.refresh(); }}>
                        ⏸
                      </button>
                    ) : c.status === "paused" ? (
                      <button className={cn(btnGhost, "!px-2 !py-1 text-xs")} onClick={async () => { await setCampaignStatus(c.id, "active"); router.refresh(); }}>
                        ▶
                      </button>
                    ) : null}
                    {c.status !== "stopped" && (
                      <button
                        className={cn(btnGhost, "!px-2 !py-1 text-xs !text-bad")}
                        onClick={async () => {
                          await setCampaignStatus(c.id, "stopped");
                          router.refresh();
                          toast(`Campaign for ${c.company} stopped`, {
                            action: { label: "Undo", onClick: async () => { await setCampaignStatus(c.id, "active"); router.refresh(); } },
                          });
                        }}
                      >
                        ■
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {c.leads.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-xs">
                      <span>{PERSONA_ICON[l.persona] ?? "•"}</span>
                      <span className="min-w-0 flex-1 truncate">{l.contact}</span>
                      <span className="num text-ink-faint">{l.sent} sent · {l.pending} pending</span>
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        l.status === "replied" ? "bg-good/15 text-good"
                        : l.status === "active" ? "bg-accent-soft text-accent"
                        : "bg-line text-ink-faint"
                      )}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
                {c.appId && (
                  <Link href={`/applications/${c.appId}`} className="mt-2 inline-block text-[11px] text-ink-faint hover:text-accent">
                    open application →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ---------------- ANALYTICS ---------------- */}
      {tab === "Analytics" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Emails sent", value: analytics.sent },
              { label: "DM tasks created", value: analytics.dmTasks },
              { label: "Replies", value: analytics.replied },
              { label: "Reply rate", value: `${analytics.replyRate}%` },
            ].map((t) => (
              <div key={t.label} className="glass p-4">
                <div className="num text-2xl font-semibold">{t.value}</div>
                <div className="mt-0.5 text-xs text-ink-dim">{t.label}</div>
              </div>
            ))}
          </div>
          <section className="glass p-5">
            <h2 className="mb-1 text-sm font-semibold">Who replies?</h2>
            <p className="mb-4 text-xs text-ink-faint">Contacted vs replied, by persona</p>
            <div className="space-y-2.5">
              {analytics.byPersona.map((p) => {
                const max = Math.max(1, ...analytics.byPersona.map((x) => x.contacted));
                return (
                  <div key={p.persona}>
                    <div className="mb-0.5 flex items-baseline justify-between text-xs">
                      <span className="text-ink-dim">{PERSONA_ICON[p.persona]} {p.persona}s</span>
                      <span className="num text-ink">
                        {p.replied}/{p.contacted} replied
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-[4px] bg-line/60">
                      <div className="h-full rounded-[4px] bg-accent/40" style={{ width: `${(p.contacted / max) * 100}%` }}>
                        <div className="h-full rounded-[4px] bg-good" style={{ width: p.contacted ? `${(p.replied / p.contacted) * 100}%` : 0 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ---------------- HISTORY ---------------- */}
      {tab === "History" && (
        <div className="glass overflow-hidden">
          {history.length === 0 ? (
            <p className="p-10 text-center text-sm text-ink-dim">Nothing sent yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">What</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((m) => (
                  <tr key={m.id} className="border-b border-line/50">
                    <td className="num whitespace-nowrap px-3 py-2 text-xs text-ink-faint">
                      {m.sentAt ? new Date(m.sentAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    <td className="px-3 py-2">{m.contact?.name ?? "?"}</td>
                    <td className="px-3 py-2 text-ink-dim">{m.company}</td>
                    <td className="max-w-56 truncate px-3 py-2 text-xs text-ink-dim" title={m.subject ?? m.body}>
                      {m.type === "dm_task" ? "💬 DM task" : `✉ ${m.subject ?? ""}`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.gmailThreadId && (
                        <a
                          className="text-xs text-accent hover:underline"
                          href={`https://mail.google.com/mail/u/0/#all/${m.gmailThreadId}`}
                          target="_blank" rel="noreferrer"
                        >
                          thread ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function EditBox({ msg, onDone }: { msg: Msg; onDone: () => void }) {
  const [subject, setSubject] = useState(msg.subject ?? "");
  const [body, setBody] = useState(msg.body);
  const [saving, setSaving] = useState(false);
  return (
    <div className="space-y-2">
      {msg.type === "email" && (
        <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
      )}
      <textarea className={cn(inputCls, "h-40 resize-y")} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex justify-end">
        <button
          className={btnPrimary}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await updateMessage(msg.id, { subject: subject || null, body });
            toast.success("Message updated");
            onDone();
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
