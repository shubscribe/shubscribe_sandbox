"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { inputCls, btnPrimary, btnGhost } from "@/components/ui/bits";
import { generateDraft, saveDraftToGmail, type Draft } from "@/actions/discovery";
import { cn } from "@/lib/utils";

const TONES = ["warm", "direct", "formal"] as const;

export function DraftModal({
  open, onClose, applicationId, company, kind, contact,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  company: string;
  kind: "referral" | "followup";
  contact: { id: string; name: string; email: string | null } | null;
}) {
  const [tone, setTone] = useState<(typeof TONES)[number]>("warm");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"email" | "dm">("email");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setBusy(true);
    setDraft(null);
    const res = await generateDraft({ applicationId, contactId: contact?.id ?? null, kind, tone });
    setBusy(false);
    if ("error" in res) { toast.error(res.error); return; }
    setDraft(res);
  }

  function copy() {
    const text = tab === "email" && draft ? `Subject: ${draft.emailSubject}\n\n${draft.emailBody}` : draft?.dm ?? "";
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function toGmail() {
    if (!draft) return;
    setSaving(true);
    const res = await saveDraftToGmail({
      to: contact?.email ?? "",
      subject: draft.emailSubject,
      body: draft.emailBody,
    });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else toast.success("Saved to your Gmail drafts ✓");
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {kind === "referral" ? "Referral request" : "Follow-up"}
          <span className="ml-2 text-sm font-normal text-ink-dim">
            {contact ? `→ ${contact.name}` : `→ ${company}`}
          </span>
        </h2>
        <div className="glass-pill ml-auto flex gap-1 p-1 text-xs">
          {TONES.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={cn("rounded-full px-3 py-1 capitalize", tone === t ? "bg-accent text-white" : "text-ink-dim hover:text-ink")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!draft ? (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-ink-dim">
            {kind === "referral"
              ? "Generates a low-pressure referral ask using your profile blurb and this job's details."
              : "Generates a polite nudge about this application going quiet."}
          </p>
          <button className={btnPrimary} onClick={generate} disabled={busy}>
            {busy ? "Writing…" : "✨ Generate draft"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="glass-pill flex w-fit gap-1 p-1 text-xs">
            <button onClick={() => setTab("email")} className={cn("rounded-full px-3 py-1", tab === "email" ? "bg-accent text-white" : "text-ink-dim")}>
              ✉ Email
            </button>
            <button onClick={() => setTab("dm")} className={cn("rounded-full px-3 py-1", tab === "dm" ? "bg-accent text-white" : "text-ink-dim")}>
              💬 LinkedIn DM
            </button>
          </div>

          {tab === "email" ? (
            <>
              <input
                className={cn(inputCls, "font-medium")}
                value={draft.emailSubject}
                onChange={(e) => setDraft({ ...draft, emailSubject: e.target.value })}
              />
              <textarea
                className={cn(inputCls, "h-56 resize-y text-sm leading-relaxed")}
                value={draft.emailBody}
                onChange={(e) => setDraft({ ...draft, emailBody: e.target.value })}
              />
            </>
          ) : (
            <textarea
              className={cn(inputCls, "h-40 resize-y text-sm leading-relaxed")}
              value={draft.dm}
              onChange={(e) => setDraft({ ...draft, dm: e.target.value })}
            />
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button className={btnGhost} onClick={generate} disabled={busy}>
              {busy ? "Rewriting…" : "↻ Regenerate"}
            </button>
            <button className={btnGhost} onClick={copy}>⧉ Copy</button>
            {tab === "email" && (
              <button
                className={btnPrimary}
                onClick={toGmail}
                disabled={saving}
                title={contact?.email ? undefined : "No email on this contact — the draft is created without a recipient"}
              >
                {saving ? "Saving…" : "Save to Gmail drafts"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
