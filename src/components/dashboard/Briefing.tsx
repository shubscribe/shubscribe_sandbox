"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveMessage, skipMessage } from "@/actions/outreach";
import { approveDiscovered } from "@/actions/discovery";
import { saveSettings } from "@/actions/misc";
import { cn } from "@/lib/utils";

/* ---------- setup checklist ---------- */

export type SetupItem = { label: string; done: boolean; href: string; hint: string };

export function SetupChecklist({ items }: { items: SetupItem[] }) {
  const [hidden, setHidden] = useState(false);
  const doneCount = items.filter((i) => i.done).length;
  if (hidden || doneCount === items.length) return null;

  return (
    <section className="glass mb-5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Finish setting up{" "}
          <span className="num text-xs font-normal text-ink-faint">
            {doneCount}/{items.length}
          </span>
        </h2>
        <button
          className="text-xs text-ink-faint hover:text-ink"
          onClick={async () => { setHidden(true); await saveSettings({ setupDismissed: true }); }}
        >
          dismiss
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition",
              item.done ? "text-ink-faint" : "text-ink-dim hover:bg-accent-soft/50 hover:text-ink"
            )}
          >
            <span className={cn("text-sm", item.done ? "text-good" : "text-ink-faint")}>
              {item.done ? "✓" : "○"}
            </span>
            <span className={cn(item.done && "line-through")}>{item.label}</span>
            {!item.done && <span className="ml-auto text-[10px] text-ink-faint">{item.hint}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- outreach queue preview ---------- */

export type QueueItem = {
  id: string; subject: string | null; body: string;
  contactName: string; persona: string; company: string; type: string;
};

export function QueuePreview({ items, total }: { items: QueueItem[]; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (total === 0) return null;

  async function act(id: string, fn: (id: string) => Promise<void>, msg: string) {
    setBusy(id);
    try { await fn(id); toast.success(msg); router.refresh(); } finally { setBusy(null); }
  }

  return (
    <section className="glass p-4">
      <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold">
        <span>✉ Drafts waiting for approval</span>
        <Link href="/outreach" className="text-xs font-normal text-accent hover:underline">
          all {total} →
        </Link>
      </h2>
      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="glass p-2.5">
            <div className="mb-1 flex items-baseline gap-2 text-xs">
              <span className="font-medium text-ink">{m.contactName}</span>
              <span className="text-ink-faint">{m.persona} · {m.company}</span>
              {m.type === "dm_task" && <span className="text-ink-faint">LinkedIn DM</span>}
            </div>
            <p className="line-clamp-2 text-xs text-ink-dim">
              {m.subject ? <span className="font-medium">{m.subject} — </span> : null}
              {m.body}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                disabled={busy === m.id}
                className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                onClick={() => act(m.id, approveMessage, "Approved — sends on the next tick inside your window")}
              >
                ✓ Approve
              </button>
              <button
                disabled={busy === m.id}
                className="glass-pill px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink disabled:opacity-50"
                onClick={() => act(m.id, skipMessage, "Skipped")}
              >
                Skip
              </button>
              <Link href="/outreach" className="glass-pill px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink">
                ✎ Edit
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- new matches preview ---------- */

export type MatchItem = {
  id: string; company: string; title: string; fitScore: number | null; source: string;
};

export function MatchesPreview({ items, total }: { items: MatchItem[]; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (total === 0) return null;

  return (
    <section className="glass p-4">
      <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold">
        <span>◈ New job matches</span>
        <Link href="/discover" className="text-xs font-normal text-accent hover:underline">
          all {total} →
        </Link>
      </h2>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d.id} className="glass flex items-center gap-3 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.company}</div>
              <div className="truncate text-xs text-ink-faint">{d.title} · {d.source}</div>
            </div>
            {d.fitScore != null && (
              <span
                className="num shrink-0 text-xs font-semibold"
                style={{ color: d.fitScore >= 75 ? "var(--good)" : d.fitScore >= 50 ? "var(--warn)" : "var(--ink-faint)" }}
              >
                {d.fitScore}
              </span>
            )}
            <button
              disabled={busy === d.id}
              className="glass-pill shrink-0 px-2.5 py-1 text-[11px] font-medium text-accent disabled:opacity-50"
              onClick={async () => {
                setBusy(d.id);
                try {
                  const res = await approveDiscovered(d.id);
                  if (res.error) toast.error(res.error);
                  else toast.success(`${d.company} added to your pipeline`);
                  router.refresh();
                } finally { setBusy(null); }
              }}
            >
              ✓ Add
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
