"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: "◉" },
  { href: "/applications", label: "Apps", icon: "▦" },
  { href: "/discover", label: "Discover", icon: "◈" },
  { href: "/outreach", label: "Outreach", icon: "✉" },
];

const MORE = [
  { href: "/tasks", label: "Tasks", icon: "☑" },
  { href: "/contacts", label: "Contacts", icon: "☺" },
  { href: "/analytics", label: "Analytics", icon: "◔" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function BottomNav({
  discoverCount = 0,
  outreachCount = 0,
}: {
  discoverCount?: number;
  outreachCount?: number;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => pathname.startsWith(m.href));

  const badge = (n: number) =>
    n > 0 && (
      <span className="num absolute -right-2 -top-1 rounded-full bg-accent px-1.5 text-[9px] font-semibold leading-4 text-white">
        {n > 99 ? "99+" : n}
      </span>
    );

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="glass-raised absolute bottom-20 left-4 right-4 p-2 pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {MORE.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
                  pathname.startsWith(m.href)
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-dim active:bg-accent-soft/50"
                )}
              >
                <span className="w-4 text-center">{m.icon}</span>
                {m.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-line px-4 py-3">
              <button
                className="text-sm text-ink-dim"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
              </button>
              <button
                className="text-sm text-ink-faint"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        className="glass-raised fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around !rounded-2xl px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="Primary"
      >
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px]",
                active ? "text-accent" : "text-ink-faint"
              )}
            >
              <span className="relative text-base leading-5">
                {t.icon}
                {t.href === "/discover" && badge(discoverCount)}
                {t.href === "/outreach" && badge(outreachCount)}
              </span>
              {t.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px]",
            moreActive || moreOpen ? "text-accent" : "text-ink-faint"
          )}
        >
          <span className="text-base leading-5">⋯</span>
          More
        </button>
      </nav>
    </>
  );
}
