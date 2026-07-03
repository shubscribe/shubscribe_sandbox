"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveStage } from "@/actions/applications";
import { Chip, Stars } from "@/components/ui/bits";
import { cn, salaryLabel, timeAgo } from "@/lib/utils";
import type { AppListItem, Stage } from "@/lib/data";

type ColKey =
  | "company" | "title" | "stage" | "appliedAt" | "salary" | "source"
  | "lastActivity" | "location" | "workMode" | "jobType" | "excitement" | "tags";

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "stage", label: "Stage" },
  { key: "appliedAt", label: "Applied" },
  { key: "salary", label: "Salary" },
  { key: "source", label: "Source" },
  { key: "lastActivity", label: "Last activity" },
  { key: "location", label: "Location" },
  { key: "workMode", label: "Mode" },
  { key: "jobType", label: "Type" },
  { key: "excitement", label: "Excitement" },
  { key: "tags", label: "Tags" },
];

const DEFAULT_COLS: ColKey[] = [
  "company", "title", "stage", "appliedAt", "salary", "source", "lastActivity",
];

const STORAGE_KEY = "jobtracker.table.columns";

function sortValue(a: AppListItem, key: ColKey): string | number {
  switch (key) {
    case "company": return a.company.toLowerCase();
    case "title": return a.title.toLowerCase();
    case "stage": return a.stage?.position ?? 99;
    case "appliedAt": return a.appliedAt?.getTime() ?? 0;
    case "salary": return a.salaryMax ?? a.salaryMin ?? 0;
    case "source": return a.source?.name.toLowerCase() ?? "";
    case "lastActivity": return a.lastActivityAt?.getTime() ?? 0;
    case "location": return a.location?.toLowerCase() ?? "";
    case "workMode": return a.workMode ?? "";
    case "jobType": return a.jobType ?? "";
    case "excitement": return a.excitement ?? 0;
    case "tags": return a.tags.length;
  }
}

export function AppTable({
  apps,
  stages,
  onOpen,
}: {
  apps: AppListItem[];
  stages: Stage[];
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [cols, setCols] = useState<ColKey[]>(DEFAULT_COLS);
  const [picker, setPicker] = useState(false);
  const [sortKey, setSortKey] = useState<ColKey>("lastActivity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCols(JSON.parse(saved));
    } catch { /* keep defaults */ }
  }, []);

  function saveCols(next: ColKey[]) {
    setCols(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? c : -c;
    });
  }, [apps, sortKey, sortDir]);

  function header(key: ColKey, label: string) {
    return (
      <th
        key={key}
        onClick={() => {
          if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
          else { setSortKey(key); setSortDir("desc"); }
        }}
        className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint hover:text-ink"
      >
        {label} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    );
  }

  async function changeStage(app: AppListItem, toStageId: string) {
    const from = app.stageId;
    await moveStage(app.id, toStageId);
    router.refresh();
    const toName = stages.find((s) => s.id === toStageId)?.name;
    toast.success(`${app.company} → ${toName}`, {
      action: from
        ? { label: "Undo", onClick: async () => { await moveStage(app.id, from); router.refresh(); } }
        : undefined,
    });
  }

  function cell(a: AppListItem, key: ColKey) {
    switch (key) {
      case "company":
        return <span className="font-medium">{a.company}</span>;
      case "title":
        return <span className="text-ink-dim">{a.title}</span>;
      case "stage":
        return (
          <select
            value={a.stageId ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => changeStage(a, e.target.value)}
            className="rounded-lg border-none bg-transparent px-1.5 py-0.5 text-xs font-medium"
            style={{ color: a.stage?.color, backgroundColor: `${a.stage?.color ?? "#888"}18` }}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        );
      case "appliedAt":
        return <span className="num text-xs">{a.appliedAt ? a.appliedAt.toLocaleDateString() : "—"}</span>;
      case "salary":
        return <span className="num text-xs">{salaryLabel(a.salaryMin, a.salaryMax, a.currency) ?? "—"}</span>;
      case "source":
        return a.source ? <Chip color={a.source.color}>{a.source.name}</Chip> : "—";
      case "lastActivity":
        return <span className="text-xs text-ink-faint">{timeAgo(a.lastActivityAt)}</span>;
      case "location":
        return <span className="text-xs">{a.location ?? "—"}</span>;
      case "workMode":
        return <span className="text-xs">{a.workMode ?? "—"}</span>;
      case "jobType":
        return <span className="text-xs">{a.jobType ?? "—"}</span>;
      case "excitement":
        return <Stars value={a.excitement} size="text-xs" />;
      case "tags":
        return (
          <span className="flex gap-1">
            {a.tags.map((t) => <Chip key={t.id} color={t.color}>{t.name}</Chip>)}
          </span>
        );
    }
  }

  return (
    <div className="glass relative flex-1 overflow-hidden">
      <div className="flex items-center justify-end border-b border-line px-3 py-2">
        <div className="relative">
          <button
            onClick={() => setPicker((p) => !p)}
            className="text-xs text-ink-dim transition hover:text-ink"
          >
            ⚙ Columns
          </button>
          {picker && (
            <div className="glass-raised absolute right-0 top-7 z-20 w-44 p-2">
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-accent-soft">
                  <input
                    type="checkbox"
                    checked={cols.includes(c.key)}
                    onChange={(e) =>
                      saveCols(
                        e.target.checked
                          ? ALL_COLUMNS.filter((x) => cols.includes(x.key) || x.key === c.key).map((x) => x.key)
                          : cols.filter((k) => k !== c.key)
                      )
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {ALL_COLUMNS.filter((c) => cols.includes(c.key)).map((c) => header(c.key, c.label))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr
                key={a.id}
                onClick={() => onOpen(a.id)}
                className="cursor-pointer border-b border-line/50 transition hover:bg-accent-soft/40"
              >
                {ALL_COLUMNS.filter((c) => cols.includes(c.key)).map((c) => (
                  <td key={c.key} className={cn("whitespace-nowrap px-3 py-2")}>
                    {cell(a, c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
