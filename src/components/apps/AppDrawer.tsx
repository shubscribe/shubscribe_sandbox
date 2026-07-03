"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchApplication } from "@/actions/misc";
import { AppDetail } from "./AppDetail";
import type { AppFull, Stage, Source, Tag } from "@/lib/data";

export function AppDrawer({
  appId,
  stages,
  sources,
  tags,
  onClose,
}: {
  appId: string;
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
  onClose: () => void;
}) {
  const [app, setApp] = useState<AppFull | null>(null);

  const load = useCallback(async () => {
    const data = await fetchApplication(appId);
    setApp(data);
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
      if (e.key === "Escape" && !typing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-raised drawer-in thin-scroll m-3 w-full max-w-xl overflow-y-auto !rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/applications/${appId}`}
            className="text-xs text-ink-faint transition hover:text-accent"
          >
            ⤢ Open full page
          </Link>
          <button
            onClick={onClose}
            className="glass-pill flex h-8 w-8 items-center justify-center text-sm text-ink-dim hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {app ? (
          <AppDetail
            app={app}
            stages={stages}
            sources={sources}
            tags={tags}
            onChanged={load}
            onClosed={onClose}
          />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-ink-faint">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
