"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Chip, inputCls, btnPrimary } from "@/components/ui/bits";
import {
  scanNow, approveDiscovered, dismissDiscovered,
  createSearch, toggleSearch, deleteSearch, addWatch, deleteWatch,
} from "@/actions/discovery";
import { cn, salaryLabel, timeAgo } from "@/lib/utils";

type Discovered = {
  id: string; source: string; company: string; title: string; url: string | null;
  location: string | null; remote: boolean | null; salaryMin: number | null;
  salaryMax: number | null; currency: string | null; description: string | null;
  postedAt: Date | null; fitScore: number | null; fitReason: string | null; createdAt: Date | null;
};
type Search = {
  id: string; name: string; keywords: string; location: string | null;
  remoteOnly: boolean; salaryMin: number | null; enabled: boolean;
};
type Watch = { id: string; company: string; ats: string; slug: string; keywords: string | null };

const SOURCE_LABEL: Record<string, string> = {
  adzuna: "Adzuna", jsearch: "JSearch", remotive: "Remotive",
  remoteok: "RemoteOK", hn: "Hacker News", greenhouse: "Greenhouse", lever: "Lever",
};

function fitColor(score: number | null) {
  if (score == null) return "var(--ink-faint)";
  if (score >= 75) return "var(--good)";
  if (score >= 50) return "var(--warn)";
  return "var(--bad)";
}

export function DiscoverView({
  inbox, searches, watched, keys, lastScanAt,
}: {
  inbox: Discovered[];
  searches: Search[];
  watched: Watch[];
  keys: { adzuna: boolean; jsearch: boolean; ai: boolean };
  lastScanAt: string | null;
}) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState({ name: "", keywords: "", location: "", remoteOnly: false, salaryMin: "" });
  const [watchDraft, setWatchDraft] = useState({ company: "", ats: "greenhouse" as "greenhouse" | "lever", slug: "", keywords: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    try {
      const report = await scanNow();
      const errs = report.discovery.sources.filter((s) => s.status === "error").length;
      toast.success(
        `Scan done — ${report.discovery.inserted} new job(s)${report.gmail.suggested ? `, ${report.gmail.suggested} email suggestion(s)` : ""}${errs ? ` (${errs} source(s) failed)` : ""}`
      );
      router.refresh();
    } catch {
      toast.error("Scan failed — check your keys in Settings.");
    } finally {
      setScanning(false);
    }
  }

  async function approve(j: Discovered) {
    setBusy(j.id);
    const res = await approveDiscovered(j.id);
    setBusy(null);
    if (res.error) { toast.error(res.error); return; }
    router.refresh();
    toast.success(`${j.company} added to Saved — referral contacts loading via Apollo`, {
      action: res.applicationId
        ? { label: "Open", onClick: () => router.push(`/applications/${res.applicationId}`) }
        : undefined,
    });
  }

  async function dismiss(j: Discovered) {
    await dismissDiscovered(j.id);
    router.refresh();
    toast(`Dismissed ${j.company}`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Discover</h1>
        <span className="text-xs text-ink-faint">
          {lastScanAt ? `last scan ${timeAgo(new Date(lastScanAt))}` : "never scanned"}
        </span>
        <button className={cn(btnPrimary, "ml-auto")} onClick={scan} disabled={scanning}>
          {scanning ? "Scanning…" : "⟳ Scan now"}
        </button>
      </div>

      {(!keys.adzuna || !keys.jsearch || !keys.ai) && (
        <div className="glass mb-4 p-3 text-xs text-ink-dim">
          {!keys.adzuna && <span className="mr-3">Adzuna key missing (Settings) — that source is skipped.</span>}
          {!keys.jsearch && <span className="mr-3">JSearch key missing — that source is skipped.</span>}
          {!keys.ai && <span>No AI key — jobs arrive unscored.</span>}
          <span className="text-ink-faint"> Remotive, RemoteOK, HN and your watchlist work with no keys.</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* inbox */}
        <div className="space-y-3">
          {inbox.length === 0 ? (
            <div className="glass p-12 text-center">
              <div className="mb-2 text-3xl">📡</div>
              <p className="text-sm text-ink-dim">
                Nothing in the inbox. Add a saved search or watchlist company on the
                right, then hit <span className="text-accent">Scan now</span> — matches
                land here with a fit score.
              </p>
            </div>
          ) : (
            inbox.map((j) => (
              <div key={j.id} className="glass p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="num flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold"
                    style={{ color: fitColor(j.fitScore), backgroundColor: `${j.fitScore != null ? "" : ""}color-mix(in oklab, ${fitColor(j.fitScore)} 14%, transparent)` }}
                    title={j.fitReason ?? "unscored"}
                  >
                    {j.fitScore ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{j.title}</span>
                      <span className="text-sm text-ink-dim">{j.company}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Chip>{SOURCE_LABEL[j.source] ?? j.source}</Chip>
                      {j.location && <Chip>{j.location}</Chip>}
                      {j.remote && <Chip>remote</Chip>}
                      {salaryLabel(j.salaryMin, j.salaryMax, j.currency) && (
                        <Chip className="num">{salaryLabel(j.salaryMin, j.salaryMax, j.currency)}</Chip>
                      )}
                      {j.postedAt && <span className="text-[11px] text-ink-faint">posted {timeAgo(j.postedAt)}</span>}
                    </div>
                    {j.fitReason && <p className="mt-1.5 text-xs text-ink-faint">{j.fitReason}</p>}
                    {expanded === j.id && j.description && (
                      <p className="thin-scroll mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-ink-dim">
                        {j.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex gap-1.5">
                      <button
                        className="rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                        onClick={() => approve(j)}
                        disabled={busy === j.id}
                      >
                        {busy === j.id ? "Adding…" : "✓ Add"}
                      </button>
                      <button
                        className="glass-pill px-3 py-1.5 text-xs text-ink-faint hover:text-bad"
                        onClick={() => dismiss(j)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      {j.description && (
                        <button className="text-ink-faint hover:text-ink" onClick={() => setExpanded(expanded === j.id ? null : j.id)}>
                          {expanded === j.id ? "less" : "details"}
                        </button>
                      )}
                      {j.url && (
                        <a className="text-ink-faint hover:text-accent" href={j.url} target="_blank" rel="noreferrer">
                          posting ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* config rail */}
        <div className="space-y-5">
          <section className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">Saved searches</h2>
            <div className="space-y-2">
              {searches.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" checked={s.enabled} className="accent-[var(--accent)]"
                    onChange={async (e) => { await toggleSearch(s.id, e.target.checked); router.refresh(); }}
                    title={s.enabled ? "Enabled" : "Disabled"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate", !s.enabled && "text-ink-faint line-through")}>{s.name}</div>
                    <div className="truncate text-[11px] text-ink-faint">
                      {s.keywords}{s.location ? ` · ${s.location}` : ""}{s.remoteOnly ? " · remote" : ""}{s.salaryMin ? ` · $${Math.round(s.salaryMin / 1000)}k+` : ""}
                    </div>
                  </div>
                  <button className="text-ink-faint hover:text-bad" onClick={async () => { await deleteSearch(s.id); router.refresh(); }}>✕</button>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <input className={inputCls} placeholder="Search name (e.g. Senior FE)" value={searchDraft.name} onChange={(e) => setSearchDraft({ ...searchDraft, name: e.target.value })} />
              <input className={inputCls} placeholder="Keywords (e.g. react typescript)" value={searchDraft.keywords} onChange={(e) => setSearchDraft({ ...searchDraft, keywords: e.target.value })} />
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Location" value={searchDraft.location} onChange={(e) => setSearchDraft({ ...searchDraft, location: e.target.value })} />
                <input className={cn(inputCls, "!w-24")} placeholder="$ min" type="number" value={searchDraft.salaryMin} onChange={(e) => setSearchDraft({ ...searchDraft, salaryMin: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-dim">
                <input type="checkbox" checked={searchDraft.remoteOnly} className="accent-[var(--accent)]" onChange={(e) => setSearchDraft({ ...searchDraft, remoteOnly: e.target.checked })} />
                Remote only
              </label>
              <button
                className={cn(btnPrimary, "w-full")}
                disabled={!searchDraft.name.trim() || !searchDraft.keywords.trim()}
                onClick={async () => {
                  await createSearch({
                    name: searchDraft.name.trim(), keywords: searchDraft.keywords.trim(),
                    location: searchDraft.location.trim() || null,
                    remoteOnly: searchDraft.remoteOnly,
                    salaryMin: searchDraft.salaryMin ? Number(searchDraft.salaryMin) : null,
                  });
                  setSearchDraft({ name: "", keywords: "", location: "", remoteOnly: false, salaryMin: "" });
                  router.refresh();
                  toast.success("Search saved — it runs on every scan");
                }}
              >
                + Add search
              </button>
            </div>
          </section>

          <section className="glass p-4">
            <h2 className="mb-1 text-sm font-semibold">Company watchlist</h2>
            <p className="mb-3 text-[11px] text-ink-faint">
              Polls the company&apos;s public Greenhouse/Lever board — the slug is the last
              part of their careers URL (e.g. boards.greenhouse.io/<b>stripe</b>).
            </p>
            <div className="space-y-2">
              {watched.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{w.company}</div>
                    <div className="truncate text-[11px] text-ink-faint">{w.ats} · {w.slug}{w.keywords ? ` · ${w.keywords}` : ""}</div>
                  </div>
                  <button className="text-ink-faint hover:text-bad" onClick={async () => { await deleteWatch(w.id); router.refresh(); }}>✕</button>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Company" value={watchDraft.company} onChange={(e) => setWatchDraft({ ...watchDraft, company: e.target.value })} />
                <select className={cn(inputCls, "!w-32")} value={watchDraft.ats} onChange={(e) => setWatchDraft({ ...watchDraft, ats: e.target.value as "greenhouse" | "lever" })}>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Board slug" value={watchDraft.slug} onChange={(e) => setWatchDraft({ ...watchDraft, slug: e.target.value })} />
                <input className={inputCls} placeholder="Filter keywords" value={watchDraft.keywords} onChange={(e) => setWatchDraft({ ...watchDraft, keywords: e.target.value })} />
              </div>
              <button
                className={cn(btnPrimary, "w-full")}
                disabled={!watchDraft.company.trim() || !watchDraft.slug.trim()}
                onClick={async () => {
                  await addWatch({
                    company: watchDraft.company.trim(), ats: watchDraft.ats,
                    slug: watchDraft.slug.trim(), keywords: watchDraft.keywords.trim() || null,
                  });
                  setWatchDraft({ company: "", ats: "greenhouse", slug: "", keywords: "" });
                  router.refresh();
                  toast.success("Company watched");
                }}
              >
                + Watch company
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

