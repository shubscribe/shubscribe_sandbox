"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inputCls } from "@/components/ui/bits";
import type { TestResult } from "@/actions/diagnostics";

/** A single credential field: password input + Save (appears when dirty, also
    auto-saves on blur) + Test (pings the real service) + a live status line. */
export function ApiKeyField({
  label,
  saved,
  onSave,
  onTest,
  placeholder = "paste key",
  type = "password",
}: {
  label: string;
  saved: boolean;
  onSave: (value: string) => Promise<void>;
  onTest?: () => Promise<TestResult>;
  placeholder?: string;
  type?: "password" | "text";
}) {
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(value.trim());
      setDirty(false);
      setValue("");
      setResult(null);
      toast.success(`${label} saved`);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!onTest) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await onTest());
    } catch {
      setResult({ ok: false, message: "Couldn't run the test — try again." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-dim">{label}</label>
      <div className="flex flex-wrap gap-2">
        <input
          type={type}
          className={cn(inputCls, "min-w-40 flex-1")}
          placeholder={saved ? "••••••••  (saved — paste to replace)" : placeholder}
          value={value}
          onChange={(e) => { setValue(e.target.value); setDirty(true); }}
          onBlur={() => { if (dirty && value.trim()) save(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
        />
        {dirty && value.trim() && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        {onTest && (saved || dirty) && (
          <button
            type="button"
            onClick={test}
            disabled={testing || saving}
            className="glass-pill shrink-0 px-3.5 py-2 text-xs font-medium text-ink-dim transition hover:text-ink disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test"}
          </button>
        )}
      </div>
      {result && (
        <p
          className={cn(
            "mt-1.5 flex items-start gap-1.5 text-xs",
            result.ok ? "text-good" : "text-bad"
          )}
        >
          <span className="shrink-0">{result.ok ? "✓" : "✕"}</span>
          <span>{result.message}</span>
        </p>
      )}
    </div>
  );
}
