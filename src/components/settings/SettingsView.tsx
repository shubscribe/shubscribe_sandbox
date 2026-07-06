"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveSettings, createStage, updateStage, deleteStage, reorderStages,
  createSource, deleteSource, createTag, deleteTag,
  clearDemoData, deleteAllData, bulkImport,
} from "@/actions/misc";
import { setArchived, deleteApplication } from "@/actions/applications";
import { gmailDisconnect } from "@/actions/discovery";
import {
  updateStep, addStep, deleteStep, resetSequence,
  uploadResume, setDefaultResume, deleteResume,
} from "@/actions/outreach";
import { Field, Chip, inputCls, btnGhost } from "@/components/ui/bits";
import { cn, STAGE_COLORS } from "@/lib/utils";
import type { AppSettings } from "@/lib/settings";
import type { Stage, Source, Tag } from "@/lib/data";

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn("glass p-5", danger && "border-bad/40")}>
      <h2 className={cn("mb-4 text-sm font-semibold", danger && "text-bad")}>{title}</h2>
      {children}
    </section>
  );
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]?.trim() ?? ""])));
}

type SeqStep = {
  id: string; persona: string; position: number;
  type: string; delayDays: number; framing: string;
};
type ResumeRow = { id: string; name: string; filename: string; isDefault: boolean };

export function SettingsView({
  settings, stages, sources, tags, archived, hasDemo, sequence = [], resumes = [],
}: {
  settings: AppSettings;
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
  archived: { id: string; company: string; title: string }[];
  hasDemo: boolean;
  sequence?: SeqStep[];
  resumes?: ResumeRow[];
}) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [newStage, setNewStage] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newTag, setNewTag] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  async function persist(patch: Partial<AppSettings>) {
    setS((prev) => ({ ...prev, ...patch }));
    await saveSettings(patch);
    toast.success("Saved");
    router.refresh();
  }

  async function move(stageId: string, dir: -1 | 1) {
    const ids = stages.map((x) => x.id);
    const i = ids.indexOf(stageId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderStages(ids);
    router.refresh();
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { toast.error("No rows found in that CSV."); return; }
    const mapped = rows.map((r) => ({
      company: r.company ?? r.Company ?? "",
      title: r.title ?? r.Title ?? r.position ?? "",
      url: r.url ?? r.URL,
      location: r.location,
      workMode: r.workMode ?? r.work_mode,
      jobType: r.jobType ?? r.job_type,
      salaryMin: r.salaryMin ? Number(r.salaryMin) : undefined,
      salaryMax: r.salaryMax ? Number(r.salaryMax) : undefined,
      stageName: r.stage ?? r.Stage,
      sourceName: r.source ?? r.Source,
      appliedAt: r.appliedAt ?? r.applied,
      notes: r.notes,
    }));
    const n = await bulkImport(mapped);
    toast.success(`Imported ${n} application(s)`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <Section title="Profile & goals">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className={inputCls} defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && persist({ name: e.target.value })} />
          </Field>
          <Field label="Target role">
            <input className={inputCls} defaultValue={s.targetRole} onBlur={(e) => e.target.value !== s.targetRole && persist({ targetRole: e.target.value })} />
          </Field>
          <Field label={`Weekly application goal: ${s.weeklyGoal}`}>
            <input
              type="range" min={1} max={40} value={s.weeklyGoal}
              onChange={(e) => setS({ ...s, weeklyGoal: Number(e.target.value) })}
              onMouseUp={() => persist({ weeklyGoal: s.weeklyGoal })}
              onTouchEnd={() => persist({ weeklyGoal: s.weeklyGoal })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
          <Field label={`Stale after: ${s.staleDays} days`}>
            <input
              type="range" min={2} max={21} value={s.staleDays}
              onChange={(e) => setS({ ...s, staleDays: Number(e.target.value) })}
              onMouseUp={() => persist({ staleDays: s.staleDays })}
              onTouchEnd={() => persist({ staleDays: s.staleDays })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
        </div>
      </Section>

      <Section title="Pipeline stages">
        <div className="space-y-2">
          {stages.map((st, i) => (
            <div key={st.id} className="flex items-center gap-2">
              <input
                type="color" defaultValue={st.color}
                onBlur={(e) => e.target.value !== st.color && updateStage(st.id, { color: e.target.value }).then(() => router.refresh())}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border-none bg-transparent"
              />
              <input
                className={inputCls} defaultValue={st.name}
                onBlur={(e) => e.target.value !== st.name && updateStage(st.id, { name: e.target.value }).then(() => router.refresh())}
              />
              <button
                title="Terminal stage — excluded from active counts & staleness"
                onClick={() => updateStage(st.id, { isTerminal: !st.isTerminal }).then(() => router.refresh())}
                className={cn("shrink-0 rounded-lg px-2 py-1 text-xs", st.isTerminal ? "bg-bad/20 text-bad" : "text-ink-faint hover:text-ink")}
              >
                end
              </button>
              <div className="flex shrink-0 flex-col">
                <button disabled={i === 0} onClick={() => move(st.id, -1)} className="text-[10px] text-ink-faint hover:text-ink disabled:opacity-20">▲</button>
                <button disabled={i === stages.length - 1} onClick={() => move(st.id, 1)} className="text-[10px] text-ink-faint hover:text-ink disabled:opacity-20">▼</button>
              </div>
              <button
                onClick={async () => {
                  if (stages.length <= 1) { toast.error("Keep at least one stage."); return; }
                  await deleteStage(st.id);
                  router.refresh();
                  toast.success(`Stage "${st.name}" removed — its applications moved to "${stages.find((x) => x.id !== st.id)?.name}"`);
                }}
                className="shrink-0 text-ink-faint hover:text-bad"
                aria-label={`Delete ${st.name}`}
              >
                ✕
              </button>
            </div>
          ))}
          <input
            className={inputCls}
            placeholder="Add stage… (Enter)"
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && newStage.trim()) {
                await createStage(newStage.trim(), STAGE_COLORS[stages.length % STAGE_COLORS.length], false);
                setNewStage("");
                router.refresh();
              }
            }}
          />
        </div>
      </Section>

      <Section title="Sources & tags">
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-ink-dim">Sources</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {sources.map((src) => (
              <span key={src.id} className="group inline-flex items-center">
                <Chip color={src.color}>
                  {src.name}
                  <button
                    className="ml-0.5 hidden group-hover:inline"
                    onClick={async () => { await deleteSource(src.id); router.refresh(); }}
                  >
                    ✕
                  </button>
                </Chip>
              </span>
            ))}
            <input
              className={cn(inputCls, "!w-32 !rounded-full !py-1 text-xs")}
              placeholder="+ source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newSource.trim()) {
                  await createSource(newSource.trim(), STAGE_COLORS[sources.length % STAGE_COLORS.length]);
                  setNewSource("");
                  router.refresh();
                }
              }}
            />
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-ink-dim">Tags</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t.id} className="group inline-flex items-center">
                <Chip color={t.color}>
                  {t.name}
                  <button
                    className="ml-0.5 hidden group-hover:inline"
                    onClick={async () => { await deleteTag(t.id); router.refresh(); }}
                  >
                    ✕
                  </button>
                </Chip>
              </span>
            ))}
            <input
              className={cn(inputCls, "!w-32 !rounded-full !py-1 text-xs")}
              placeholder="+ tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  await createTag(newTag.trim(), STAGE_COLORS[(tags.length + 3) % STAGE_COLORS.length]);
                  setNewTag("");
                  router.refresh();
                }
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Integrations">
        <div className="grid grid-cols-3 gap-3">
          <Field label="AI provider">
            <select
              className={inputCls}
              value={s.aiProvider}
              onChange={(e) => persist({ aiProvider: e.target.value as AppSettings["aiProvider"] })}
            >
              <option value="">Off</option>
              <option value="gemini">Gemini (free tier)</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </Field>
          <Field label="AI API key" className="col-span-2">
            <input
              type="password" className={inputCls}
              placeholder={s.aiApiKey ? "••••••••  (saved)" : "paste key"}
              onBlur={(e) => e.target.value && persist({ aiApiKey: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Apollo.io API key (contact finding)">
            <input
              type="password" className={inputCls}
              placeholder={s.apolloApiKey ? "••••••••  (saved)" : "paste key"}
              onBlur={(e) => e.target.value && persist({ apolloApiKey: e.target.value })}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Keys are stored in your own database and only used server-side. AI key powers
          paste-text extraction; Apollo key powers &ldquo;Find contacts&rdquo; on applications.
        </p>
      </Section>

      <Section title="Job discovery (Discover page)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adzuna App ID">
            <input type="password" className={inputCls}
              placeholder={s.adzunaAppId ? "••••••  (saved)" : "free at developer.adzuna.com"}
              onBlur={(e) => e.target.value && persist({ adzunaAppId: e.target.value })} />
          </Field>
          <Field label="Adzuna App Key">
            <input type="password" className={inputCls}
              placeholder={s.adzunaAppKey ? "••••••  (saved)" : "paste key"}
              onBlur={(e) => e.target.value && persist({ adzunaAppKey: e.target.value })} />
          </Field>
          <Field label="JSearch (RapidAPI) key" className="col-span-2">
            <input type="password" className={inputCls}
              placeholder={s.jsearchKey ? "••••••  (saved)" : "free tier at rapidapi.com/jsearch"}
              onBlur={(e) => e.target.value && persist({ jsearchKey: e.target.value })} />
          </Field>
          <Field label="Profile blurb (powers fit scores & referral drafts)" className="col-span-2">
            <textarea className={cn(inputCls, "h-24 resize-y")}
              placeholder="e.g. 5 years full-stack (React/Node), shipped consumer products at two startups, strongest in frontend performance…"
              defaultValue={s.profileBlurb}
              onBlur={(e) => e.target.value !== s.profileBlurb && persist({ profileBlurb: e.target.value })} />
          </Field>
          <Field label="Default draft tone">
            <select className={inputCls} value={s.draftTone}
              onChange={(e) => persist({ draftTone: e.target.value as AppSettings["draftTone"] })}>
              <option value="warm">Warm</option>
              <option value="direct">Direct</option>
              <option value="formal">Formal</option>
            </select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Remotive, RemoteOK, Hacker News and your company watchlist need no keys at all.
          Scans run daily via cron (set CRON_SECRET on Vercel) or the Scan-now button.
        </p>
      </Section>

      <Section title="Outreach autopilot">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">
            Jobs scoring at or above the threshold are auto-added and get a campaign
            (leads found, first messages drafted). Nothing sends until you approve it
            in the Outreach queue.
          </p>
          <button
            onClick={() => persist({ outreachPaused: !s.outreachPaused })}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium",
              s.outreachPaused ? "bg-bad/20 text-bad" : "bg-good/20 text-good"
            )}
          >
            {s.outreachPaused ? "⏸ Paused — resume" : "● Running — pause all"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Auto-add at fit score ≥ ${s.autoAddThreshold}`}>
            <input
              type="range" min={50} max={95} step={5} value={s.autoAddThreshold}
              onChange={(e) => setS({ ...s, autoAddThreshold: Number(e.target.value) })}
              onMouseUp={() => persist({ autoAddThreshold: s.autoAddThreshold })}
              onTouchEnd={() => persist({ autoAddThreshold: s.autoAddThreshold })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
          <Field label={`Daily send cap: ${s.dailySendCap} emails`}>
            <input
              type="range" min={1} max={40} value={s.dailySendCap}
              onChange={(e) => setS({ ...s, dailySendCap: Number(e.target.value) })}
              onMouseUp={() => persist({ dailySendCap: s.dailySendCap })}
              onTouchEnd={() => persist({ dailySendCap: s.dailySendCap })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
          <Field label="Send window — from">
            <select className={inputCls} value={s.sendWindowStart}
              onChange={(e) => persist({ sendWindowStart: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </Field>
          <Field label="Send window — until">
            <select className={inputCls} value={s.sendWindowEnd}
              onChange={(e) => persist({ sendWindowEnd: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </Field>
          <Field label="Morning digest email" className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              <input
                type="checkbox"
                checked={s.dailyDigest}
                onChange={(e) => persist({ dailyDigest: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Email me a summary each morning when drafts, matches or tasks are waiting
              (sent to your connected Gmail address)
            </label>
          </Field>
          <Field label="Proof points (one per line — fed into every draft)" className="col-span-2">
            <textarea className={cn(inputCls, "h-24 resize-y")}
              placeholder={"e.g.\nCut page load 40% at Acme\nLed migration to React 19 for 2M-user app"}
              defaultValue={s.proofPoints}
              onBlur={(e) => e.target.value !== s.proofPoints && persist({ proofPoints: e.target.value })} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          The heartbeat that releases approved sends runs every ~30 min — set the
          APP_URL and CRON_SECRET secrets on your GitHub repo (see README) or press
          &ldquo;Run tick now&rdquo; on the Outreach page.
        </p>
      </Section>

      <Section title="Outreach sequence">
        <p className="mb-3 text-xs text-ink-faint">
          What gets drafted for each lead, per persona. Delay is days after the
          previous step was sent. &ldquo;LinkedIn DM&rdquo; steps become tasks with
          copy-ready text instead of emails.
        </p>
        <div className="space-y-4">
          {(["recruiter", "manager", "peer"] as const).map((persona) => {
            const steps = sequence.filter((st) => st.persona === persona)
              .sort((a, b) => a.position - b.position);
            return (
              <div key={persona}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium capitalize text-ink-dim">{persona}s</div>
                  <button
                    className="text-[11px] text-ink-faint hover:text-ink"
                    onClick={async () => {
                      await addStep(persona, (steps.at(-1)?.position ?? 0) + 1);
                      router.refresh();
                    }}
                  >
                    + add step
                  </button>
                </div>
                <div className="space-y-2">
                  {steps.map((st) => (
                    <div key={st.id} className="glass-pill flex items-start gap-2 p-2">
                      <span className="num mt-1.5 w-5 shrink-0 text-center text-[11px] text-ink-faint">
                        {st.position}
                      </span>
                      <select
                        className={cn(inputCls, "!w-28 shrink-0 text-xs")}
                        defaultValue={st.type}
                        onChange={(e) => updateStep(st.id, { type: e.target.value }).then(() => router.refresh())}
                      >
                        <option value="email">Email</option>
                        <option value="dm_task">LinkedIn DM</option>
                      </select>
                      <label className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
                        +
                        <input
                          type="number" min={0} max={30}
                          className={cn(inputCls, "!w-14 text-xs")}
                          defaultValue={st.delayDays}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== st.delayDays) updateStep(st.id, { delayDays: v }).then(() => router.refresh());
                          }}
                        />
                        d
                      </label>
                      <textarea
                        className={cn(inputCls, "h-14 flex-1 resize-y text-xs")}
                        defaultValue={st.framing}
                        onBlur={(e) => e.target.value !== st.framing && updateStep(st.id, { framing: e.target.value }).then(() => router.refresh())}
                      />
                      <button
                        className="mt-1.5 shrink-0 text-ink-faint hover:text-bad"
                        aria-label="Delete step"
                        onClick={async () => { await deleteStep(st.id); router.refresh(); }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {steps.length === 0 && (
                    <p className="text-xs text-ink-faint">No steps — this persona won&apos;t be contacted.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button
          className={cn(btnGhost, "mt-3")}
          onClick={async () => { await resetSequence(); router.refresh(); toast.success("Sequence reset to defaults"); }}
        >
          Reset to default sequence
        </button>
        <p className="mt-2 text-xs text-ink-faint">
          Edits apply to newly drafted steps; anything already in your queue keeps its text.
        </p>
      </Section>

      <Section title="Resumes">
        <div className="space-y-2">
          {resumes.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <button
                title={r.isDefault ? "Default — attached to first emails" : "Make default"}
                className={cn("shrink-0", r.isDefault ? "text-warn" : "text-ink-faint hover:text-warn")}
                onClick={async () => { await setDefaultResume(r.id); router.refresh(); }}
              >
                {r.isDefault ? "★" : "☆"}
              </button>
              <span className="flex-1 truncate">
                {r.name} <span className="text-xs text-ink-faint">({r.filename})</span>
              </span>
              <button
                className="glass-pill px-2 py-0.5 text-[11px] text-ink-faint hover:text-bad"
                onClick={async () => { await deleteResume(r.id); router.refresh(); toast.success("Resume deleted"); }}
              >
                Delete
              </button>
            </div>
          ))}
          {resumes.length === 0 && (
            <p className="text-xs text-ink-faint">
              No resume yet — upload one and it&apos;s attached to first-touch emails
              (each campaign can override it on the Outreach page).
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={btnGhost} disabled={uploadingResume} onClick={() => resumeRef.current?.click()}>
            {uploadingResume ? "Uploading…" : "⬆ Upload resume (PDF)"}
          </button>
          <input
            ref={resumeRef} type="file" accept=".pdf,.txt,.md" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploadingResume(true);
              const fd = new FormData();
              fd.set("file", f);
              fd.set("name", f.name.replace(/\.(pdf|txt|md)$/i, ""));
              const res = await uploadResume(fd);
              setUploadingResume(false);
              if (res.error) toast.error(res.error);
              else {
                toast.success(
                  res.parsedChars
                    ? "Resume uploaded — text extracted for personalization"
                    : "Resume uploaded"
                );
                router.refresh();
              }
            }}
          />
          {s.resumeText && (
            <span className="text-xs text-good">✓ text extracted — drafts use your real experience</span>
          )}
        </div>
      </Section>

      <Section title="Gmail connection">
        {s.gmailConnected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-good">✓ Connected</span>
            <span className="text-xs text-ink-faint">
              Scans find recruiter replies & interview invites and turn them into
              one-click suggestions. Approved outreach sends from this address.
              Connected before v3? Reconnect once to grant the send permission.
            </span>
            <a className={cn(btnGhost, "ml-auto")} href="/api/gmail/connect">Reconnect</a>
            <button className={cn(btnGhost, "!text-bad")}
              onClick={async () => { await gmailDisconnect(); router.refresh(); toast.success("Gmail disconnected"); }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <a className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              href="/api/gmail/connect">
              Connect Gmail
            </a>
            <span className="text-xs text-ink-faint">
              Inbox scanning, draft creation and approved-only sending. Add
              <code className="mx-1">/api/gmail/callback</code> to your Google OAuth
              redirect URIs first (see README).
            </span>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Only scan this Gmail label (optional)">
            <input
              className={inputCls} placeholder="e.g. job-search — empty scans Primary"
              defaultValue={s.emailLabel}
              onBlur={(e) => e.target.value !== s.emailLabel && persist({ emailLabel: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Data export & import">
        <div className="flex flex-wrap gap-2">
          <a className={btnGhost} href="/api/export?format=csv">⬇ Export CSV</a>
          <a className={btnGhost} href="/api/export?format=json">⬇ Full JSON backup</a>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>⬆ Import CSV</button>
          <input
            ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          CSV import expects headers: company, title, and optionally url, location,
          stage, source, salaryMin, salaryMax, workMode, jobType, appliedAt, notes.
        </p>
      </Section>

      <Section title="Archive">
        {archived.length === 0 ? (
          <p className="text-xs text-ink-faint">No archived applications.</p>
        ) : (
          <div className="space-y-2">
            {archived.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">
                  {a.company} — <span className="text-ink-dim">{a.title}</span>
                </span>
                <button
                  className="glass-pill px-2 py-0.5 text-[11px] text-ink-dim hover:text-ink"
                  onClick={async () => { await setArchived(a.id, false); router.refresh(); toast.success("Restored"); }}
                >
                  Restore
                </button>
                <button
                  className="glass-pill px-2 py-0.5 text-[11px] text-ink-faint hover:text-bad"
                  onClick={async () => { await deleteApplication(a.id); router.refresh(); toast.success("Deleted permanently"); }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Danger zone" danger>
        <div className="flex flex-wrap items-center gap-2">
          {hasDemo && (
            <button
              className={btnGhost}
              onClick={async () => { await clearDemoData(); router.refresh(); toast.success("Demo data cleared"); }}
            >
              Clear demo data
            </button>
          )}
          {!confirmWipe ? (
            <button className={cn(btnGhost, "!text-bad")} onClick={() => setConfirmWipe(true)}>
              Delete ALL data…
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-bad">This wipes every application, task and contact. Sure?</span>
              <button
                className="rounded-xl bg-bad px-3 py-1.5 font-medium text-white"
                onClick={async () => {
                  await deleteAllData();
                  setConfirmWipe(false);
                  router.refresh();
                  toast.success("All data deleted");
                }}
              >
                Yes, wipe it
              </button>
              <button className={btnGhost} onClick={() => setConfirmWipe(false)}>Cancel</button>
            </span>
          )}
        </div>
      </Section>
    </div>
  );
}
