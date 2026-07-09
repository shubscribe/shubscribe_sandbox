"use client";

import { useEffect, useState } from "react";

function greetingFor(h: number): string {
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Winding down";
}

/** Renders the greeting + date from the *browser's* clock, so it matches the
    user's local time instead of the Vercel server's UTC clock. */
export function DashboardHeader({ firstName, targetRole }: { firstName: string; targetRole: string }) {
  // First paint (server + hydration) uses a time-neutral greeting to avoid a
  // mismatch; the effect fills in the real local-time greeting right after mount.
  const [local, setLocal] = useState<{ greeting: string; date: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    setLocal({
      greeting: greetingFor(now.getHours()),
      date: now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
    });
  }, []);

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {local ? local.greeting : "Hello"}{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        {targetRole && <p className="text-sm text-ink-dim">Hunting: {targetRole}</p>}
      </div>
      <p className="text-xs text-ink-faint">{local?.date ?? ""}</p>
    </div>
  );
}
