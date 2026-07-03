"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setTaskCompleted, snoozeTask } from "@/actions/misc";
import { logFollowUp, setArchived } from "@/actions/applications";
import { cn } from "@/lib/utils";

export function DueTaskList({
  tasks,
}: {
  tasks: { id: string; title: string; dueAt: number | null; app: { id: string; company: string } | null }[];
}) {
  const router = useRouter();
  if (tasks.length === 0)
    return <p className="text-xs text-ink-faint">Nothing due — clear runway. ✈️</p>;

  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const overdue = t.dueAt != null && t.dueAt < new Date().setHours(0, 0, 0, 0);
        return (
          <div key={t.id} className="group flex items-center gap-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              onChange={async () => {
                await setTaskCompleted(t.id, true);
                router.refresh();
                toast.success("Task done ✓", {
                  action: {
                    label: "Undo",
                    onClick: async () => { await setTaskCompleted(t.id, false); router.refresh(); },
                  },
                });
              }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {t.title}
              {t.app && (
                <Link href={`/applications/${t.app.id}`} className="ml-1.5 text-xs text-ink-faint hover:text-accent">
                  {t.app.company}
                </Link>
              )}
            </span>
            {overdue && <span className="text-[10px] font-medium text-bad">overdue</span>}
            <button
              className="hidden shrink-0 text-[11px] text-ink-faint hover:text-ink group-hover:inline"
              onClick={async () => { await snoozeTask(t.id, 1); router.refresh(); toast("Snoozed to tomorrow"); }}
            >
              +1d
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function StaleList({
  apps,
}: {
  apps: {
    id: string; company: string; title: string;
    stageName: string; stageColor: string; lastActivity: number | null;
  }[];
}) {
  const router = useRouter();
  if (apps.length === 0)
    return <p className="text-xs text-ink-faint">Everything has recent movement. Nice.</p>;

  return (
    <div className="space-y-2">
      {apps.map((a) => {
        const days = a.lastActivity ? Math.floor((Date.now() - a.lastActivity) / 86400000) : null;
        return (
          <div key={a.id} className="glass flex items-center gap-3 p-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.stageColor }} />
            <Link href={`/applications/${a.id}`} className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium hover:text-accent">{a.company}</div>
              <div className="truncate text-xs text-ink-faint">
                {a.stageName}{days != null ? ` · quiet ${days}d` : ""}
              </div>
            </Link>
            <button
              className={cn("glass-pill px-2 py-1 text-[11px] text-ink-dim hover:text-ink")}
              onClick={async () => {
                await logFollowUp(a.id);
                router.refresh();
                toast.success(`Follow-up logged for ${a.company}`);
              }}
            >
              ✉ Followed up
            </button>
            <button
              className="glass-pill px-2 py-1 text-[11px] text-ink-faint hover:text-bad"
              onClick={async () => {
                await setArchived(a.id, true);
                router.refresh();
                toast.success(`${a.company} archived`, {
                  action: {
                    label: "Undo",
                    onClick: async () => { await setArchived(a.id, false); router.refresh(); },
                  },
                });
              }}
            >
              Archive
            </button>
          </div>
        );
      })}
    </div>
  );
}
