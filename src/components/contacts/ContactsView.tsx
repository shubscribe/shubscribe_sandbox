"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createContact, updateContact, deleteContact } from "@/actions/misc";
import { Field, Chip, inputCls, btnPrimary, btnGhost } from "@/components/ui/bits";
import { Modal } from "@/components/ui/Modal";
import { cn, monogram } from "@/lib/utils";
import type { Contact } from "@/lib/data";

type Item = { contact: Contact; apps: { id: string; company: string; title: string }[] };

const emptyDraft = { name: "", title: "", company: "", email: "", phone: "", linkedinUrl: "", notes: "" };

export function ContactsView({ items }: { items: Item[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { id?: string; draft: typeof emptyDraft }>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(({ contact: c }) =>
      `${c.name} ${c.company ?? ""} ${c.title ?? ""} ${c.email ?? ""}`.toLowerCase().includes(needle)
    );
  }, [items, q]);

  async function save() {
    if (!modal || !modal.draft.name.trim()) return;
    if (modal.id) {
      await updateContact(modal.id, { ...modal.draft, name: modal.draft.name.trim() });
      toast.success("Contact updated");
    } else {
      await createContact({ ...modal.draft, name: modal.draft.name.trim() });
      toast.success("Contact added");
    }
    setModal(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <input
          className={cn(inputCls, "ml-auto !w-52 !rounded-full !py-1.5 text-xs")}
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={btnPrimary} onClick={() => setModal({ draft: emptyDraft })}>
          + Add contact
        </button>
      </div>

      {items.length === 0 ? (
        <div className="glass p-12 text-center">
          <div className="mb-2 text-3xl">🤝</div>
          <p className="text-sm text-ink-dim">
            No contacts yet. Add recruiters and hiring managers here, link them to
            applications, or pull them automatically with the Apollo button on any
            application.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(({ contact: c, apps }) => (
            <div key={c.id} className="glass p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {monogram(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    {c.origin === "apollo" && <Chip>apollo</Chip>}
                  </div>
                  <div className="truncate text-xs text-ink-dim">
                    {[c.title, c.company].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <button
                  className="text-xs text-ink-faint hover:text-ink"
                  onClick={() =>
                    setModal({
                      id: c.id,
                      draft: {
                        name: c.name, title: c.title ?? "", company: c.company ?? "",
                        email: c.email ?? "", phone: c.phone ?? "",
                        linkedinUrl: c.linkedinUrl ?? "", notes: c.notes ?? "",
                      },
                    })
                  }
                >
                  Edit
                </button>
              </div>
              <div className="mt-3 space-y-1 text-xs text-ink-dim">
                {c.email && (
                  <div>✉ <a className="hover:text-accent" href={`mailto:${c.email}`}>{c.email}</a></div>
                )}
                {c.phone && <div>☏ {c.phone}</div>}
                {c.linkedinUrl && (
                  <div>
                    in{" "}
                    <a className="hover:text-accent" href={c.linkedinUrl} target="_blank" rel="noreferrer">
                      LinkedIn ↗
                    </a>
                  </div>
                )}
              </div>
              {apps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2">
                  {apps.map((a) => (
                    <Link key={a.id} href={`/applications/${a.id}`}>
                      <Chip>{a.company}</Chip>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        {modal && (
          <>
            <h2 className="mb-4 text-lg font-semibold">{modal.id ? "Edit contact" : "New contact"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *" className="col-span-2">
                <input className={inputCls} value={modal.draft.name} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, name: e.target.value } })} autoFocus />
              </Field>
              <Field label="Title">
                <input className={inputCls} value={modal.draft.title} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, title: e.target.value } })} />
              </Field>
              <Field label="Company">
                <input className={inputCls} value={modal.draft.company} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, company: e.target.value } })} />
              </Field>
              <Field label="Email">
                <input className={inputCls} value={modal.draft.email} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, email: e.target.value } })} />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={modal.draft.phone} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, phone: e.target.value } })} />
              </Field>
              <Field label="LinkedIn URL" className="col-span-2">
                <input className={inputCls} value={modal.draft.linkedinUrl} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, linkedinUrl: e.target.value } })} />
              </Field>
              <Field label="Notes" className="col-span-2">
                <textarea className={cn(inputCls, "h-16")} value={modal.draft.notes} onChange={(e) => setModal({ ...modal, draft: { ...modal.draft, notes: e.target.value } })} />
              </Field>
            </div>
            <div className="mt-5 flex justify-between">
              {modal.id ? (
                <button
                  className="text-xs text-ink-faint hover:text-bad"
                  onClick={async () => {
                    const id = modal.id!;
                    setModal(null);
                    await deleteContact(id);
                    router.refresh();
                    toast.success("Contact deleted");
                  }}
                >
                  Delete
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => setModal(null)}>Cancel</button>
                <button className={btnPrimary} onClick={save} disabled={!modal.draft.name.trim()}>
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
