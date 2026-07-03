"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Chip, Stars, CompanyLogo } from "@/components/ui/bits";
import { setExcitement, setArchived, moveStage } from "@/actions/applications";
import { createTask } from "@/actions/misc";
import { faviconUrl, salaryLabel, cn } from "@/lib/utils";
import type { AppListItem, Stage } from "@/lib/data";

export function AppCard({
  app,
  stages,
  onOpen,
  overlay,
}: {
  app: AppListItem;
  stages: Stage[];
  onOpen: (id: string) => void;
  overlay?: boolean;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const salary = salaryLabel(app.salaryMin, app.salaryMax, app.currency);

  const orderedStages = stages;
  const idx = orderedStages.findIndex((s) => s.id === app.stageId);
  const nextStage = idx >= 0 ? orderedStages[idx + 1] : null;

  async function advance() {
    if (!nextStage) return;
    const from = app.stageId;
    await moveStage(app.id, nextStage.id);
    router.refresh();
    toast.success(`${app.company} → ${nextStage.name}`, {
      action: from
        ? { label: "Undo", onClick: async () => { await moveStage(app.id, from); router.refresh(); } }
        : undefined,
    });
  }

  async function quickTask() {
    await createTask({
      title: `Follow up with ${app.company}`,
      applicationId: app.id,
      dueAt: Date.now() + 2 * 86400000,
    });
    router.refresh();
    toast.success(`Follow-up task added for ${app.company} (due in 2 days)`);
  }

  async function archive() {
    await setArchived(app.id, true);
    router.refresh();
    toast.success(`${app.company} archived`, {
      action: {
        label: "Undo",
        onClick: async () => { await setArchived(app.id, false); router.refresh(); },
      },
    });
  }

  return (
    <div
      onClick={() => onOpen(app.id)}
      className={cn(
        "glass group relative cursor-pointer p-3 transition hover:-translate-y-0.5 hover:shadow-lg",
        overlay && "shadow-2xl"
      )}
      style={{ borderLeft: `3px solid ${app.stage?.color ?? "var(--line)"}` }}
    >
      <div className="flex items-start gap-2.5">
        <CompanyLogo url={faviconUrl(app.url)} company={app.company} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-snug">{app.title}</div>
          <div className="truncate text-xs text-ink-dim">{app.company}</div>
        </div>
        {app.openTasks > 0 && (
          <span
            className="num shrink-0 rounded-full bg-warn/15 px-1.5 text-[10px] font-medium text-warn"
            title={`${app.openTasks} open task(s)`}
          >
            {app.openTasks}
          </span>
        )}
      </div>

      {(salary || app.location || app.workMode) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {salary && <Chip className="num">{salary}</Chip>}
          {app.location && <Chip>{app.location}</Chip>}
          {app.workMode && <Chip>{app.workMode}</Chip>}
          {app.tags.map((t) => (
            <Chip key={t.id} color={t.color}>{t.name}</Chip>
          ))}
        </div>
      )}

      {/* hover quick actions */}
      {!overlay && (
        <div
          className="absolute -top-2.5 right-2 hidden items-center gap-1 group-hover:flex"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="glass-raised flex items-center gap-0.5 rounded-full px-1.5 py-0.5">
            <Stars
              value={app.excitement}
              onChange={async (v) => {
                await setExcitement(app.id, v);
                router.refresh();
              }}
              size="text-xs"
            />
            <button
              title="Add follow-up task"
              onClick={quickTask}
              className="px-1 text-xs text-ink-dim hover:text-ink"
            >
              ✓
            </button>
            {nextStage && (
              <button
                title={`Advance to ${nextStage.name}`}
                onClick={advance}
                className="px-1 text-xs text-ink-dim hover:text-ink"
              >
                →
              </button>
            )}
            <div className="relative">
              <button
                title="More"
                onClick={() => setMenu((m) => !m)}
                className="px-1 text-xs text-ink-dim hover:text-ink"
              >
                ⋯
              </button>
              {menu && (
                <div className="glass-raised absolute right-0 top-6 z-20 w-36 p-1 text-xs">
                  <button
                    className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft"
                    onClick={() => { setMenu(false); onOpen(app.id); }}
                  >
                    Open
                  </button>
                  <button
                    className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft"
                    onClick={() => router.push(`/applications/${app.id}`)}
                  >
                    Open full page
                  </button>
                  {app.url && (
                    <a
                      className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft"
                      href={app.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View posting ↗
                    </a>
                  )}
                  <button
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-bad hover:bg-bad/10"
                    onClick={archive}
                  >
                    Archive
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
