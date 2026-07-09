"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Field, inputCls, btnPrimary, btnGhost } from "@/components/ui/bits";
import { AddApplicationModal } from "@/components/add/AddApplicationModal";
import { NAV_ICONS } from "@/components/ui/icons";
import { createTask } from "@/actions/misc";
import type { Stage, Source, Tag } from "@/lib/data";

const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl+K", "Command palette"],
  ["N", "New application"],
  ["T", "New task"],
  ["B / L", "Board / list view (Applications)"],
  ["1–8", "Go to page"],
  ["Esc", "Close dialogs"],
  ["?", "This help"],
];

function QuickTaskModal({
  open,
  onClose,
  apps,
}: {
  open: boolean;
  onClose: () => void;
  apps: { id: string; company: string; title: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [appId, setAppId] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        applicationId: appId || null,
        dueAt: due ? new Date(due).getTime() : null,
      });
      toast.success("Task added");
      setTitle("");
      setAppId("");
      setDue("");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold">New task</h2>
      <div className="space-y-3">
        <Field label="Task">
          <input
            className={inputCls}
            placeholder="Follow up with recruiter…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            autoFocus
          />
        </Field>
        <Field label="Linked application">
          <select className={inputCls} value={appId} onChange={(e) => setAppId(e.target.value)}>
            <option value="">None</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} — {a.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input
            type="date"
            className={inputCls}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Add task"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function GlobalUI({
  stages,
  sources,
  tags,
  apps,
}: {
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
  apps: { id: string; company: string; title: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [palette, setPalette] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const anyModal = palette || addOpen || taskOpen || helpOpen;

  const go = useCallback(
    (href: string) => {
      setPalette(false);
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    // global "add application" hooks from other components
    const openAdd = () => setAddOpen(true);
    window.addEventListener("open-add-application", openAdd);
    return () => window.removeEventListener("open-add-application", openAdd);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      const el = e.target as HTMLElement;
      const typing =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
      if (typing || anyModal || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "n": case "N": e.preventDefault(); setAddOpen(true); break;
        case "t": case "T": e.preventDefault(); setTaskOpen(true); break;
        case "?": e.preventDefault(); setHelpOpen(true); break;
        case "b": case "B":
          if (pathname.startsWith("/applications")) router.push("/applications?view=board");
          break;
        case "l": case "L":
          if (pathname.startsWith("/applications")) router.push("/applications?view=table");
          break;
        case "1": router.push("/"); break;
        case "2": router.push("/applications"); break;
        case "3": router.push("/discover"); break;
        case "4": router.push("/outreach"); break;
        case "5": router.push("/tasks"); break;
        case "6": router.push("/contacts"); break;
        case "7": router.push("/analytics"); break;
        case "8": router.push("/settings"); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router, anyModal]);

  return (
    <>
      {/* floating quick-add */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-xl transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        title="Add application (N)"
        aria-label="Add application"
      >
        +
      </button>

      <AddApplicationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        stages={stages}
        sources={sources}
        tags={tags}
      />
      <QuickTaskModal open={taskOpen} onClose={() => setTaskOpen(false)} apps={apps} />

      {/* help overlay */}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
        <div className="space-y-2">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between text-sm">
              <span className="text-ink-dim">{desc}</span>
              <kbd className="glass-pill px-2 py-0.5 text-xs">{keys}</kbd>
            </div>
          ))}
        </div>
      </Modal>

      {/* command palette */}
      {palette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPalette(false);
          }}
        >
          <Command
            className="glass-raised w-full max-w-lg overflow-hidden p-2 pop-in"
            label="Command palette"
          >
            <Command.Input
              autoFocus
              placeholder="Jump to an application, or type a command…"
              className="w-full bg-transparent px-3 py-3 text-sm outline-none placeholder:text-ink-faint"
            />
            <Command.List className="thin-scroll max-h-80 overflow-y-auto px-1 pb-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-faint">
                Nothing found.
              </Command.Empty>
              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint"
              >
                <PaletteItem onSelect={() => { setPalette(false); setAddOpen(true); }}>
                  ＋ Add application
                </PaletteItem>
                <PaletteItem onSelect={() => { setPalette(false); setTaskOpen(true); }}>
                  ☑ Add task
                </PaletteItem>
              </Command.Group>
              <Command.Group
                heading="Go to"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint"
              >
                <PaletteItem onSelect={() => go("/")}><span className="flex items-center gap-2.5"><NAV_ICONS.dashboard size={17} /> Dashboard</span></PaletteItem>
                <PaletteItem onSelect={() => go("/applications")}><span className="flex items-center gap-2.5"><NAV_ICONS.applications size={17} /> Applications</span></PaletteItem>
                <PaletteItem onSelect={() => go("/discover")}><span className="flex items-center gap-2.5"><NAV_ICONS.discover size={17} /> Discover</span></PaletteItem>
                <PaletteItem onSelect={() => go("/outreach")}><span className="flex items-center gap-2.5"><NAV_ICONS.outreach size={17} /> Outreach</span></PaletteItem>
                <PaletteItem onSelect={() => go("/tasks")}><span className="flex items-center gap-2.5"><NAV_ICONS.tasks size={17} /> Tasks</span></PaletteItem>
                <PaletteItem onSelect={() => go("/contacts")}><span className="flex items-center gap-2.5"><NAV_ICONS.contacts size={17} /> Contacts</span></PaletteItem>
                <PaletteItem onSelect={() => go("/analytics")}><span className="flex items-center gap-2.5"><NAV_ICONS.analytics size={17} /> Analytics</span></PaletteItem>
                <PaletteItem onSelect={() => go("/settings")}><span className="flex items-center gap-2.5"><NAV_ICONS.settings size={17} /> Settings</span></PaletteItem>
              </Command.Group>
              {apps.length > 0 && (
                <Command.Group
                  heading="Applications"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint"
                >
                  {apps.map((a) => (
                    <PaletteItem key={a.id} onSelect={() => go(`/applications/${a.id}`)}>
                      {a.company} — <span className="text-ink-dim">{a.title}</span>
                    </PaletteItem>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}

function PaletteItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="cursor-pointer rounded-xl px-3 py-2 text-sm data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
    >
      {children}
    </Command.Item>
  );
}
