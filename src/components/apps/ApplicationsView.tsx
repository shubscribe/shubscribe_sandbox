"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { inputCls } from "@/components/ui/bits";
import { KanbanBoard } from "./KanbanBoard";
import { AppTable } from "./AppTable";
import { AppDrawer } from "./AppDrawer";
import type { AppListItem, Stage, Source, Tag } from "@/lib/data";

export function ApplicationsView({
  apps,
  stages,
  sources,
  tags,
  initialView,
  initialOpen,
}: {
  apps: AppListItem[];
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
  initialView: "board" | "table";
  initialOpen: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "table">(initialView);
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return apps.filter((a) => {
      if (needle && !`${a.company} ${a.title} ${a.location ?? ""}`.toLowerCase().includes(needle))
        return false;
      if (stageFilter && a.stageId !== stageFilter) return false;
      if (sourceFilter && a.sourceId !== sourceFilter) return false;
      if (modeFilter && a.workMode !== modeFilter) return false;
      return true;
    });
  }, [apps, q, stageFilter, sourceFilter, modeFilter]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold tracking-tight">Applications</h1>
        <div className="glass-pill flex gap-1 p-1 text-xs">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-3 py-1 capitalize transition",
                view === v ? "bg-accent text-white" : "text-ink-dim hover:text-ink"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            className={cn(inputCls, "!w-44 !rounded-full !py-1.5 text-xs")}
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={cn(inputCls, "!w-36 !rounded-full !py-1.5 text-xs")}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className={cn(inputCls, "!w-36 !rounded-full !py-1.5 text-xs")}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className={cn(inputCls, "!w-36 !rounded-full !py-1.5 text-xs")}
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="">Any mode</option>
            <option value="remote">remote</option>
            <option value="hybrid">hybrid</option>
            <option value="onsite">onsite</option>
          </select>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="glass flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="text-4xl">🎯</div>
          <div className="text-lg font-medium">No applications yet</div>
          <p className="max-w-sm text-sm text-ink-dim">
            Hit the <span className="text-accent">+</span> button (or press{" "}
            <kbd className="glass-pill px-1.5 text-xs">N</kbd>) to add your first one — paste
            a job URL and we&apos;ll fill in the details.
          </p>
          <button
            className="mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => window.dispatchEvent(new Event("open-add-application"))}
          >
            Add your first application
          </button>
        </div>
      ) : view === "board" ? (
        <KanbanBoard apps={filtered} stages={stages} onOpen={setOpenId} />
      ) : (
        <AppTable apps={filtered} stages={stages} onOpen={setOpenId} />
      )}

      {openId && (
        <AppDrawer
          appId={openId}
          stages={stages}
          sources={sources}
          tags={tags}
          onClose={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
