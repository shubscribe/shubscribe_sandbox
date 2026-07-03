"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboarding } from "@/actions/misc";
import { Field, inputCls, btnPrimary, btnGhost } from "@/components/ui/bits";
import { cn, STAGE_COLORS } from "@/lib/utils";

type StageDraft = { name: string; color: string; isTerminal: boolean };

const SUGGESTED_STAGES: StageDraft[] = [
  { name: "Saved", color: "#9aa5c9", isTerminal: false },
  { name: "Applied", color: "#8b8bf5", isTerminal: false },
  { name: "Screening", color: "#5aa9e6", isTerminal: false },
  { name: "Interviewing", color: "#e09b3d", isTerminal: false },
  { name: "Offer", color: "#2fbfa4", isTerminal: false },
  { name: "Rejected", color: "#ef6292", isTerminal: true },
  { name: "Withdrawn", color: "#7d87b0", isTerminal: true },
];

const STEPS = ["You", "Pipeline", "Integrations"];

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(defaultName);
  const [targetRole, setTargetRole] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(20);
  const [stages, setStages] = useState<StageDraft[]>(SUGGESTED_STAGES);
  const [newStage, setNewStage] = useState("");
  const [aiProvider, setAiProvider] = useState<"" | "gemini" | "anthropic" | "openai">("gemini");
  const [aiApiKey, setAiApiKey] = useState("");
  const [apolloApiKey, setApolloApiKey] = useState("");

  async function finish() {
    setSaving(true);
    try {
      await completeOnboarding({
        settings: {
          name,
          targetRole,
          weeklyGoal,
          aiProvider: aiApiKey ? aiProvider : "",
          aiApiKey,
          apolloApiKey,
        },
        stages,
      });
      toast.success("Mission control is ready. Go get that job. 🚀");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Something went wrong — try again.");
      setSaving(false);
    }
  }

  return (
    <div className="glass w-full max-w-xl p-8 pop-in">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs transition",
              i === step ? "bg-accent-soft font-medium text-accent" : "text-ink-faint hover:text-ink"
            )}
          >
            <span className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
              i === step ? "bg-accent text-white" : "bg-line"
            )}>
              {i + 1}
            </span>
            {s}
          </button>
        ))}
        <button
          onClick={finish}
          disabled={saving}
          className="ml-auto text-xs text-ink-faint transition hover:text-ink"
        >
          Skip all →
        </button>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Welcome 👋</h1>
          <p className="text-sm text-ink-dim">
            A few details to personalize your mission control. Everything here is
            optional and editable later in Settings.
          </p>
          <Field label="Your name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Target role">
            <input
              className={inputCls}
              placeholder="e.g. Senior Software Engineer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </Field>
          <Field label={`Weekly application goal — ${weeklyGoal} per week`}>
            <input
              type="range"
              min={1}
              max={40}
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Your pipeline stages</h1>
          <p className="text-sm text-ink-dim">
            Applications move through these columns on your board. Rename, remove,
            reorder or recolor — terminal stages (like Rejected) don&apos;t count as
            active.
          </p>
          <div className="space-y-2">
            {stages.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) =>
                    setStages(stages.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))
                  }
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border-none bg-transparent"
                />
                <input
                  className={inputCls}
                  value={s.name}
                  onChange={(e) =>
                    setStages(stages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
                <button
                  title="Terminal stage (ends the pipeline)"
                  onClick={() =>
                    setStages(stages.map((x, j) => (j === i ? { ...x, isTerminal: !x.isTerminal } : x)))
                  }
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-xs",
                    s.isTerminal ? "bg-bad/20 text-bad" : "text-ink-faint hover:text-ink"
                  )}
                >
                  end
                </button>
                <div className="flex shrink-0 flex-col">
                  <button
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...stages];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setStages(next);
                    }}
                    className="text-[10px] text-ink-faint hover:text-ink disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    disabled={i === stages.length - 1}
                    onClick={() => {
                      const next = [...stages];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      setStages(next);
                    }}
                    className="text-[10px] text-ink-faint hover:text-ink disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>
                <button
                  onClick={() => setStages(stages.filter((_, j) => j !== i))}
                  className="shrink-0 text-ink-faint hover:text-bad"
                  aria-label={`Remove ${s.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Add a stage…"
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newStage.trim()) {
                  setStages([
                    ...stages,
                    {
                      name: newStage.trim(),
                      color: STAGE_COLORS[stages.length % STAGE_COLORS.length],
                      isTerminal: false,
                    },
                  ]);
                  setNewStage("");
                }
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Integrations (all optional)</h1>
          <p className="text-sm text-ink-dim">
            An AI key powers paste-a-job-posting → autofilled fields.{" "}
            <a
              className="text-accent underline"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Google Gemini keys are free
            </a>
            . An Apollo key powers &ldquo;find recruiters at this company&rdquo;.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="AI provider">
              <select
                className={inputCls}
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
              >
                <option value="gemini">Gemini (free)</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </Field>
            <Field label="AI API key" className="col-span-2">
              <input
                type="password"
                className={inputCls}
                placeholder="paste key or skip"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Apollo.io API key">
            <input
              type="password"
              className={inputCls}
              placeholder="paste key or skip"
              value={apolloApiKey}
              onChange={(e) => setApolloApiKey(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          className={btnGhost}
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        {step < 2 ? (
          <button className={btnPrimary} onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button className={btnPrimary} onClick={finish} disabled={saving}>
            {saving ? "Setting up…" : "Launch mission control 🚀"}
          </button>
        )}
      </div>
    </div>
  );
}
