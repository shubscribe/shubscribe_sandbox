"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Field, Chip, Stars, inputCls, btnPrimary, btnGhost } from "@/components/ui/bits";
import { createApplication } from "@/actions/applications";
import { cn, WORK_MODES, JOB_TYPES } from "@/lib/utils";
import type { Stage, Source, Tag } from "@/lib/data";

type Tab = "url" | "paste" | "manual";

type FormState = {
  company: string;
  title: string;
  url: string;
  location: string;
  workMode: string;
  jobType: string;
  salaryMin: string;
  salaryMax: string;
  salaryAsk: string;
  currency: string;
  sourceId: string;
  referrer: string;
  excitement: number | null;
  stageId: string;
  appliedAt: string;
  notes: string;
  jdText: string;
  tagIds: string[];
};

const empty = (stageId: string): FormState => ({
  company: "",
  title: "",
  url: "",
  location: "",
  workMode: "",
  jobType: "",
  salaryMin: "",
  salaryMax: "",
  salaryAsk: "",
  currency: "USD",
  sourceId: "",
  referrer: "",
  excitement: null,
  stageId,
  appliedAt: "",
  notes: "",
  jdText: "",
  tagIds: [],
});

export function AddApplicationModal({
  open,
  onClose,
  stages,
  sources,
  tags,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("url");
  const [form, setForm] = useState<FormState>(() => empty(stages[0]?.id ?? ""));
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  function close() {
    onClose();
    setTab("url");
    setForm(empty(stages[0]?.id ?? ""));
    setUrl("");
    setPasteText("");
  }

  async function fetchUrl() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/urlmeta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.blocked && !data.title) {
        toast.warning("That site blocks automated fetches — paste the job text instead.");
        setTab("paste");
        return;
      }
      set({
        url: url.trim(),
        title: data.title ?? "",
        company: data.company ?? "",
        location: data.location ?? "",
        workMode: data.workMode ?? "",
        jobType: data.jobType ?? "",
        salaryMin: data.salaryMin != null ? String(data.salaryMin) : "",
        salaryMax: data.salaryMax != null ? String(data.salaryMax) : "",
        currency: data.currency ?? "USD",
        jdText: data.description ?? data.pageText?.slice(0, 8000) ?? "",
      });
      setTab("manual");
      toast.success("Details pulled from the page — review and save.");
    } catch {
      toast.error("Couldn't reach that URL. Try pasting the job text.");
      setTab("paste");
    } finally {
      setBusy(false);
    }
  }

  async function extractPaste() {
    if (!pasteText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Extraction failed");
        if (res.status === 400) setTab("manual");
        return;
      }
      set({
        title: data.title ?? "",
        company: data.company ?? "",
        location: data.location ?? "",
        workMode: data.workMode ?? "",
        jobType: data.jobType ?? "",
        salaryMin: data.salaryMin != null ? String(data.salaryMin) : "",
        salaryMax: data.salaryMax != null ? String(data.salaryMax) : "",
        currency: data.currency ?? "USD",
        jdText: pasteText.slice(0, 12000),
      });
      setTab("manual");
      toast.success("Fields extracted — review and save.");
    } catch {
      toast.error("Extraction failed — fill in manually.");
      setTab("manual");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form.company.trim() || !form.title.trim()) {
      toast.warning("Company and title are required.");
      setTab("manual");
      return;
    }
    setSaving(true);
    try {
      await createApplication({
        company: form.company.trim(),
        title: form.title.trim(),
        url: form.url || null,
        location: form.location || null,
        workMode: form.workMode || null,
        jobType: form.jobType || null,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        salaryAsk: form.salaryAsk ? Number(form.salaryAsk) : null,
        currency: form.currency || "USD",
        sourceId: form.sourceId || null,
        referrer: form.referrer || null,
        excitement: form.excitement,
        stageId: form.stageId || null,
        appliedAt: form.appliedAt ? new Date(form.appliedAt).getTime() : null,
        notes: form.notes || null,
        jdText: form.jdText || null,
        tagIds: form.tagIds,
      });
      toast.success(`${form.company} added to your pipeline`);
      close();
      router.refresh();
    } catch {
      toast.error("Failed to save application");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} wide>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add application</h2>
        <div className="glass-pill flex gap-1 p-1 text-xs">
          {(["url", "paste", "manual"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1 capitalize transition",
                tab === t ? "bg-accent text-white" : "text-ink-dim hover:text-ink"
              )}
            >
              {t === "url" ? "From URL" : t === "paste" ? "Paste text" : "Manual"}
            </button>
          ))}
        </div>
      </div>

      {tab === "url" && (
        <div className="space-y-4">
          <Field label="Job posting URL">
            <input
              className={inputCls}
              placeholder="https://linkedin.com/jobs/view/… or any job page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchUrl()}
              autoFocus
            />
          </Field>
          <p className="text-xs text-ink-faint">
            We&apos;ll pull the title, company, salary and location from the page. Sites
            that block bots (LinkedIn often does) fall back to paste-the-text.
          </p>
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={close}>Cancel</button>
            <button className={btnPrimary} onClick={fetchUrl} disabled={busy || !url.trim()}>
              {busy ? "Fetching…" : "Fetch details"}
            </button>
          </div>
        </div>
      )}

      {tab === "paste" && (
        <div className="space-y-4">
          <Field label="Paste the full job posting text">
            <textarea
              className={cn(inputCls, "h-48 resize-y")}
              placeholder="Copy everything from the job page and paste it here…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              autoFocus
            />
          </Field>
          <p className="text-xs text-ink-faint">
            AI extraction uses the key you configured in Settings → Integrations
            (Gemini free tier works great).
          </p>
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={close}>Cancel</button>
            <button
              className={btnPrimary}
              onClick={extractPaste}
              disabled={busy || !pasteText.trim()}
            >
              {busy ? "Extracting…" : "Extract with AI"}
            </button>
          </div>
        </div>
      )}

      {tab === "manual" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company *">
              <input
                className={inputCls}
                value={form.company}
                onChange={(e) => set({ company: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Job title *">
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
            <Field label="URL" className="col-span-2">
              <input
                className={inputCls}
                value={form.url}
                onChange={(e) => set({ url: e.target.value })}
              />
            </Field>
            <Field label="Stage">
              <select
                className={inputCls}
                value={form.stageId}
                onChange={(e) => set({ stageId: e.target.value })}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                className={inputCls}
                value={form.sourceId}
                onChange={(e) => set({ sourceId: e.target.value })}
              >
                <option value="">—</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                className={inputCls}
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
              />
            </Field>
            <Field label="Referred by">
              <input
                className={inputCls}
                placeholder="Name (optional)"
                value={form.referrer}
                onChange={(e) => set({ referrer: e.target.value })}
              />
            </Field>
            <Field label="Work mode">
              <select
                className={inputCls}
                value={form.workMode}
                onChange={(e) => set({ workMode: e.target.value })}
              >
                <option value="">—</option>
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Job type">
              <select
                className={inputCls}
                value={form.jobType}
                onChange={(e) => set({ jobType: e.target.value })}
              >
                <option value="">—</option>
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Salary min">
              <input
                type="number"
                className={inputCls}
                placeholder="120000"
                value={form.salaryMin}
                onChange={(e) => set({ salaryMin: e.target.value })}
              />
            </Field>
            <Field label="Salary max">
              <input
                type="number"
                className={inputCls}
                placeholder="160000"
                value={form.salaryMax}
                onChange={(e) => set({ salaryMax: e.target.value })}
              />
            </Field>
            <Field label="Your ask">
              <input
                type="number"
                className={inputCls}
                placeholder="150000"
                value={form.salaryAsk}
                onChange={(e) => set({ salaryAsk: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <select
                className={inputCls}
                value={form.currency}
                onChange={(e) => set({ currency: e.target.value })}
              >
                {["USD", "EUR", "GBP", "INR", "CAD", "AUD"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Applied on">
              <input
                type="date"
                className={inputCls}
                value={form.appliedAt}
                onChange={(e) => set({ appliedAt: e.target.value })}
              />
            </Field>
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-dim">Excitement</span>
              <Stars value={form.excitement} onChange={(v) => set({ excitement: v })} size="text-lg" />
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-dim">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const on = form.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        set({
                          tagIds: on
                            ? form.tagIds.filter((id) => id !== t.id)
                            : [...form.tagIds, t.id],
                        })
                      }
                      className={cn("transition", !on && "opacity-40 hover:opacity-70")}
                    >
                      <Chip color={t.color}>{t.name}</Chip>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field label="Notes">
            <textarea
              className={cn(inputCls, "h-20 resize-y")}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={close}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Add application"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
