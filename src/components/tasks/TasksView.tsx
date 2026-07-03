"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createTask, setTaskCompleted, snoozeTask, deleteTask } from "@/actions/misc";
import { inputCls, btnPrimary } from "@/components/ui/bits";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/data";

type AppLite = { id: string; company: string; title: string };

function groupOf(t: Task): "overdue" | "today" | "week" | "later" | "someday" {
  if (!t.dueAt) return "someday";
  const now = new Date();
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000);
  if (t.dueAt < startOfToday) return "overdue";
  if (t.dueAt <= endOfToday) return "today";
  if (t.dueAt <= endOfWeek) return "week";
  return "later";
}

const GROUPS: { key: ReturnType<typeof groupOf>; label: string; tone?: string }[] = [
  { key: "overdue", label: "Overdue", tone: "text-bad" },
  { key: "today", label: "Today", tone: "text-accent" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "someday", label: "No date" },
];

export function TasksView({ tasks, apps }: { tasks: Task[]; apps: AppLite[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [appId, setAppId] = useState("");
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt);
  const appMap = new Map(apps.map((a) => [a.id, a]));

  async function add() {
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      applicationId: appId || null,
      dueAt: due ? new Date(due).getTime() : null,
    });
    setTitle(""); setDue("");
    router.refresh();
  }

  async function complete(t: Task) {
    await setTaskCompleted(t.id, true);
    router.refresh();
    toast.success("Task done ✓", {
      action: {
        label: "Undo",
        onClick: async () => { await setTaskCompleted(t.id, false); router.refresh(); },
      },
    });
  }

  function row(t: Task, completed = false) {
    const app = t.applicationId ? appMap.get(t.applicationId) : null;
    return (
      <div key={t.id} className="glass group flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={completed}
          onChange={async (e) => {
            if (e.target.checked) await complete(t);
            else { await setTaskCompleted(t.id, false); router.refresh(); }
          }}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm", completed && "text-ink-faint line-through")}>{t.title}</div>
          {app && (
            <Link
              href={`/applications/${app.id}`}
              className="text-xs text-ink-faint transition hover:text-accent"
            >
              {app.company} — {app.title}
            </Link>
          )}
        </div>
        {t.dueAt && (
          <span className={cn("num shrink-0 text-xs", !completed && t.dueAt.getTime() < Date.now() ? "text-bad" : "text-ink-faint")}>
            {t.dueAt.toLocaleDateString()}
          </span>
        )}
        {!completed && (
          <div className="hidden shrink-0 gap-1 group-hover:flex">
            <button
              className="glass-pill px-2 py-0.5 text-[11px] text-ink-dim hover:text-ink"
              onClick={async () => { await snoozeTask(t.id, 1); router.refresh(); toast("Snoozed +1 day"); }}
            >
              +1d
            </button>
            <button
              className="glass-pill px-2 py-0.5 text-[11px] text-ink-dim hover:text-ink"
              onClick={async () => { await snoozeTask(t.id, 3); router.refresh(); toast("Snoozed +3 days"); }}
            >
              +3d
            </button>
            <button
              className="glass-pill px-2 py-0.5 text-[11px] text-ink-faint hover:text-bad"
              onClick={async () => { await deleteTask(t.id); router.refresh(); }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Tasks</h1>

      <div className="glass mb-6 flex flex-wrap gap-2 p-3">
        <input
          className={cn(inputCls, "min-w-40 flex-1")}
          placeholder="Add a task… (Enter to save)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <select className={cn(inputCls, "!w-44")} value={appId} onChange={(e) => setAppId(e.target.value)}>
          <option value="">No application</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>{a.company}</option>
          ))}
        </select>
        <input type="date" className={cn(inputCls, "!w-36")} value={due} onChange={(e) => setDue(e.target.value)} />
        <button className={btnPrimary} onClick={add} disabled={!title.trim()}>Add</button>
      </div>

      {open.length === 0 && (
        <div className="glass p-10 text-center text-sm text-ink-dim">
          Nothing due — your runway is clear. ✈️
        </div>
      )}

      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = open.filter((t) => groupOf(t) === g.key);
          if (!items.length) return null;
          return (
            <section key={g.key}>
              <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint", g.tone)}>
                {g.label} <span className="num">({items.length})</span>
              </h2>
              <div className="space-y-2">{items.map((t) => row(t))}</div>
            </section>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="mt-8">
          <button
            className="mb-2 text-xs text-ink-faint hover:text-ink"
            onClick={() => setShowDone((s) => !s)}
          >
            {showDone ? "▾" : "▸"} Completed ({done.length})
          </button>
          {showDone && <div className="space-y-2">{done.map((t) => row(t, true))}</div>}
        </div>
      )}
    </div>
  );
}
