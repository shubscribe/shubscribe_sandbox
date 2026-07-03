"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, Chip, Stars, CompanyLogo, inputCls, btnGhost } from "@/components/ui/bits";
import {
  updateApplication, moveStage, setExcitement, setArchived, addNote, logFollowUp,
} from "@/actions/applications";
import {
  createInterview, updateInterview, deleteInterview,
  createTask, setTaskCompleted, deleteTask,
  createContact, unlinkContact, findApolloContacts,
} from "@/actions/misc";
import { cn, faviconUrl, timeAgo, WORK_MODES, JOB_TYPES, INTERVIEW_FORMATS } from "@/lib/utils";
import type { AppFull, Stage, Source, Tag } from "@/lib/data";

const ACTIVITY_ICONS: Record<string, string> = {
  created: "✦", stage_change: "→", note: "✎", task: "☑",
  interview: "🎙", contact: "☺", follow_up: "✉", archived: "▣",
};

export function AppDetail({
  app,
  stages,
  sources,
  tags,
  onChanged,
  onClosed,
}: {
  app: AppFull;
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
  onChanged: () => void;
  onClosed?: () => void;
}) {
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState("");
  const [ivDraft, setIvDraft] = useState({ round: "", when: "", format: "video", interviewers: "" });
  const [taskDraft, setTaskDraft] = useState({ title: "", due: "" });
  const [contactDraft, setContactDraft] = useState({ name: "", title: "", email: "", linkedinUrl: "" });
  const [showIvForm, setShowIvForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [apolloBusy, setApolloBusy] = useState(false);

  async function patch(p: Parameters<typeof updateApplication>[1]) {
    await updateApplication(app.id, p);
    onChanged();
  }

  async function changeStage(toStageId: string) {
    const from = app.stageId;
    await moveStage(app.id, toStageId);
    onChanged();
    router.refresh();
    const toName = stages.find((s) => s.id === toStageId)?.name;
    toast.success(`Moved to ${toName}`, {
      action: from
        ? { label: "Undo", onClick: async () => { await moveStage(app.id, from); onChanged(); router.refresh(); } }
        : undefined,
    });
  }

  async function archive() {
    await setArchived(app.id, true);
    router.refresh();
    onClosed?.();
    toast.success(`${app.company} archived`, {
      action: {
        label: "Undo",
        onClick: async () => { await setArchived(app.id, false); router.refresh(); },
      },
    });
  }

  async function apollo() {
    setApolloBusy(true);
    try {
      const res = await findApolloContacts(app.id);
      if (res && "error" in res && res.error) toast.error(res.error);
      else if (res && "added" in res) toast.success(`Linked ${res.linked} contact(s) from Apollo (${res.added} new)`);
      onChanged();
    } finally {
      setApolloBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-start gap-3">
        <CompanyLogo url={faviconUrl(app.url)} company={app.company} size={44} />
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent text-lg font-semibold outline-none"
            defaultValue={app.title}
            onBlur={(e) => e.target.value !== app.title && patch({ title: e.target.value })}
          />
          <input
            className="w-full bg-transparent text-sm text-ink-dim outline-none"
            defaultValue={app.company}
            onBlur={(e) => e.target.value !== app.company && patch({ company: e.target.value })}
          />
          <div className="mt-1 flex items-center gap-2">
            <Stars
              value={app.excitement}
              onChange={async (v) => { await setExcitement(app.id, v); onChanged(); }}
            />
            {app.url && (
              <a href={app.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                posting ↗
              </a>
            )}
            <span className="text-xs text-ink-faint">active {timeAgo(app.lastActivityAt)}</span>
          </div>
        </div>
        <select
          value={app.stageId ?? ""}
          onChange={(e) => changeStage(e.target.value)}
          className="rounded-xl border-none px-2 py-1.5 text-xs font-medium"
          style={{ color: app.stage?.color, backgroundColor: `${app.stage?.color ?? "#888"}20` }}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* details grid */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">
          <input className={inputCls} defaultValue={app.location ?? ""} onBlur={(e) => patch({ location: e.target.value || null })} />
        </Field>
        <Field label="Source">
          <select className={inputCls} value={app.sourceId ?? ""} onChange={(e) => patch({ sourceId: e.target.value || null })}>
            <option value="">—</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Work mode">
          <select className={inputCls} value={app.workMode ?? ""} onChange={(e) => patch({ workMode: e.target.value || null })}>
            <option value="">—</option>
            {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Job type">
          <select className={inputCls} value={app.jobType ?? ""} onChange={(e) => patch({ jobType: e.target.value || null })}>
            <option value="">—</option>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label={`Salary range (${app.currency ?? "USD"})`}>
          <div className="flex gap-2">
            <input type="number" className={inputCls} placeholder="min" defaultValue={app.salaryMin ?? ""} onBlur={(e) => patch({ salaryMin: e.target.value ? Number(e.target.value) : null })} />
            <input type="number" className={inputCls} placeholder="max" defaultValue={app.salaryMax ?? ""} onBlur={(e) => patch({ salaryMax: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </Field>
        <Field label="Your ask">
          <input type="number" className={inputCls} defaultValue={app.salaryAsk ?? ""} onBlur={(e) => patch({ salaryAsk: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Applied on">
          <input
            type="date"
            className={inputCls}
            defaultValue={app.appliedAt ? app.appliedAt.toISOString().slice(0, 10) : ""}
            onBlur={(e) => patch({ appliedAt: e.target.value ? new Date(e.target.value).getTime() : null })}
          />
        </Field>
        <Field label="Referred by">
          <input className={inputCls} defaultValue={app.referrer ?? ""} onBlur={(e) => patch({ referrer: e.target.value || null })} />
        </Field>
      </div>

      {/* tags */}
      {tags.length > 0 && (
        <div>
          <SectionTitle>Tags</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = app.tags.some((x) => x.id === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    patch({
                      tagIds: on
                        ? app.tags.filter((x) => x.id !== t.id).map((x) => x.id)
                        : [...app.tags.map((x) => x.id), t.id],
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

      {/* interviews */}
      <div>
        <SectionTitle
          action={
            <button className="text-xs text-accent" onClick={() => setShowIvForm((s) => !s)}>
              + Add
            </button>
          }
        >
          Interviews
        </SectionTitle>
        <div className="space-y-2">
          {app.interviews.length === 0 && !showIvForm && (
            <p className="text-xs text-ink-faint">No interviews yet.</p>
          )}
          {app.interviews.map((iv) => (
            <div key={iv.id} className="glass flex items-center gap-3 p-2.5 text-sm">
              <span className="text-base">🎙</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{iv.round}</div>
                <div className="text-xs text-ink-faint">
                  {iv.scheduledAt ? iv.scheduledAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "unscheduled"}
                  {iv.format ? ` · ${iv.format}` : ""}
                  {iv.interviewers ? ` · ${iv.interviewers}` : ""}
                </div>
              </div>
              <select
                value={iv.outcome ?? "pending"}
                onChange={async (e) => { await updateInterview(iv.id, { outcome: e.target.value }); onChanged(); }}
                className={cn(
                  "rounded-lg border-none bg-transparent px-1 py-0.5 text-xs",
                  iv.outcome === "passed" && "text-good",
                  iv.outcome === "failed" && "text-bad",
                  (!iv.outcome || iv.outcome === "pending") && "text-ink-dim"
                )}
              >
                {["pending", "passed", "failed", "cancelled"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <button
                className="text-ink-faint hover:text-bad"
                onClick={async () => { await deleteInterview(iv.id); onChanged(); }}
                aria-label="Delete interview"
              >
                ✕
              </button>
            </div>
          ))}
          {showIvForm && (
            <div className="glass grid grid-cols-2 gap-2 p-3">
              <input className={inputCls} placeholder="Round (e.g. Technical)" value={ivDraft.round} onChange={(e) => setIvDraft({ ...ivDraft, round: e.target.value })} />
              <input type="datetime-local" className={inputCls} value={ivDraft.when} onChange={(e) => setIvDraft({ ...ivDraft, when: e.target.value })} />
              <select className={inputCls} value={ivDraft.format} onChange={(e) => setIvDraft({ ...ivDraft, format: e.target.value })}>
                {INTERVIEW_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input className={inputCls} placeholder="Interviewers" value={ivDraft.interviewers} onChange={(e) => setIvDraft({ ...ivDraft, interviewers: e.target.value })} />
              <button
                className="col-span-2 rounded-xl bg-accent py-2 text-sm font-medium text-white disabled:opacity-40"
                disabled={!ivDraft.round.trim()}
                onClick={async () => {
                  await createInterview({
                    applicationId: app.id,
                    round: ivDraft.round.trim(),
                    scheduledAt: ivDraft.when ? new Date(ivDraft.when).getTime() : null,
                    format: ivDraft.format,
                    interviewers: ivDraft.interviewers || null,
                  });
                  setIvDraft({ round: "", when: "", format: "video", interviewers: "" });
                  setShowIvForm(false);
                  onChanged();
                  toast.success("Interview added");
                }}
              >
                Add interview
              </button>
            </div>
          )}
        </div>
      </div>

      {/* tasks */}
      <div>
        <SectionTitle>Tasks</SectionTitle>
        <div className="space-y-1.5">
          {app.taskList.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!t.completedAt}
                onChange={async (e) => { await setTaskCompleted(t.id, e.target.checked); onChanged(); }}
                className="accent-[var(--accent)]"
              />
              <span className={cn("flex-1", t.completedAt && "text-ink-faint line-through")}>{t.title}</span>
              {t.dueAt && (
                <span className={cn("num text-xs", !t.completedAt && t.dueAt.getTime() < Date.now() ? "text-bad" : "text-ink-faint")}>
                  {t.dueAt.toLocaleDateString()}
                </span>
              )}
              <button className="text-ink-faint hover:text-bad" onClick={async () => { await deleteTask(t.id); onChanged(); }} aria-label="Delete task">✕</button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              className={inputCls}
              placeholder="Add a task…"
              value={taskDraft.title}
              onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && taskDraft.title.trim()) {
                  await createTask({
                    title: taskDraft.title.trim(),
                    applicationId: app.id,
                    dueAt: taskDraft.due ? new Date(taskDraft.due).getTime() : null,
                  });
                  setTaskDraft({ title: "", due: "" });
                  onChanged();
                }
              }}
            />
            <input type="date" className={cn(inputCls, "!w-36")} value={taskDraft.due} onChange={(e) => setTaskDraft({ ...taskDraft, due: e.target.value })} />
          </div>
        </div>
      </div>

      {/* contacts */}
      <div>
        <SectionTitle
          action={
            <span className="flex gap-3">
              <button className="text-xs text-accent" onClick={apollo} disabled={apolloBusy}>
                {apolloBusy ? "Searching…" : "⚡ Find via Apollo"}
              </button>
              <button className="text-xs text-accent" onClick={() => setShowContactForm((s) => !s)}>
                + Add
              </button>
            </span>
          }
        >
          Contacts
        </SectionTitle>
        <div className="space-y-1.5">
          {app.contacts.length === 0 && !showContactForm && (
            <p className="text-xs text-ink-faint">No contacts linked.</p>
          )}
          {app.contacts.map((c) => (
            <div key={c.id} className="glass flex items-center gap-3 p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="truncate text-xs text-ink-faint">
                  {[c.title, c.email].filter(Boolean).join(" · ")}
                </div>
              </div>
              {c.linkedinUrl && (
                <a className="text-xs text-accent" href={c.linkedinUrl} target="_blank" rel="noreferrer">in↗</a>
              )}
              {c.origin === "apollo" && <Chip>apollo</Chip>}
              <button
                className="text-ink-faint hover:text-bad"
                onClick={async () => { await unlinkContact(app.id, c.id); onChanged(); }}
                aria-label="Unlink contact"
              >
                ✕
              </button>
            </div>
          ))}
          {showContactForm && (
            <div className="glass grid grid-cols-2 gap-2 p-3">
              <input className={inputCls} placeholder="Name *" value={contactDraft.name} onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })} />
              <input className={inputCls} placeholder="Title" value={contactDraft.title} onChange={(e) => setContactDraft({ ...contactDraft, title: e.target.value })} />
              <input className={inputCls} placeholder="Email" value={contactDraft.email} onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })} />
              <input className={inputCls} placeholder="LinkedIn URL" value={contactDraft.linkedinUrl} onChange={(e) => setContactDraft({ ...contactDraft, linkedinUrl: e.target.value })} />
              <button
                className="col-span-2 rounded-xl bg-accent py-2 text-sm font-medium text-white disabled:opacity-40"
                disabled={!contactDraft.name.trim()}
                onClick={async () => {
                  await createContact({
                    ...contactDraft,
                    name: contactDraft.name.trim(),
                    company: app.company,
                    applicationId: app.id,
                  });
                  setContactDraft({ name: "", title: "", email: "", linkedinUrl: "" });
                  setShowContactForm(false);
                  onChanged();
                }}
              >
                Add contact
              </button>
            </div>
          )}
        </div>
      </div>

      {/* notes */}
      <div>
        <SectionTitle>Notes</SectionTitle>
        <textarea
          className={cn(inputCls, "h-24 resize-y")}
          defaultValue={app.notes ?? ""}
          placeholder="Your running notes on this application…"
          onBlur={(e) => e.target.value !== (app.notes ?? "") && patch({ notes: e.target.value || null })}
        />
      </div>

      {/* activity */}
      <div>
        <SectionTitle>Activity</SectionTitle>
        <div className="mb-2 flex gap-2">
          <input
            className={inputCls}
            placeholder="Log something (e.g. 'emailed the recruiter')…"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && noteDraft.trim()) {
                await addNote(app.id, noteDraft.trim());
                setNoteDraft("");
                onChanged();
              }
            }}
          />
          <button
            className={btnGhost}
            onClick={async () => {
              await logFollowUp(app.id);
              onChanged();
              toast.success("Follow-up logged — staleness clock reset");
            }}
          >
            ✉ Log follow-up
          </button>
        </div>
        <div className="space-y-1.5">
          {app.activities.map((act) => (
            <div key={act.id} className="flex items-start gap-2 text-xs">
              <span className="w-4 text-center">{ACTIVITY_ICONS[act.type] ?? "·"}</span>
              <span className="flex-1 text-ink-dim">{act.message}</span>
              <span className="num shrink-0 text-ink-faint">{timeAgo(act.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* footer actions */}
      <div className="flex justify-between border-t border-line pt-4">
        {app.jdText ? (
          <details className="min-w-0 flex-1 pr-4">
            <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink">
              Saved job description
            </summary>
            <p className="thin-scroll mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-ink-dim">
              {app.jdText}
            </p>
          </details>
        ) : <span />}
        <button className="shrink-0 text-xs text-ink-faint transition hover:text-bad" onClick={archive}>
          Archive application
        </button>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{children}</h3>
      {action}
    </div>
  );
}
