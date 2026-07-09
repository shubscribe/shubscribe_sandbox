"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  NAV_ICONS, type NavIconName, IconMore, IconSun, IconMoon, IconSignOut, IconHelp, IconBell,
} from "@/components/ui/icons";
import NotificationPanel from "@/components/shell/NotificationPanel";

const TABS: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/", label: "Home", icon: "dashboard" },
  { href: "/applications", label: "Apps", icon: "applications" },
  { href: "/discover", label: "Discover", icon: "discover" },
  { href: "/outreach", label: "Outreach", icon: "outreach" },
];

const MORE: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/contacts", label: "Contacts", icon: "contacts" },
  { href: "/analytics", label: "Analytics", icon: "analytics" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const HELP_URL = "https://github.com/shubscribe/shubscribe_sandbox#readme";

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
  const [notifOpen, setNotifOpen] = useState(false);
  const moreActive = MORE.some((m) => pathname.startsWith(m.href));

  const badge = (n: number) =>
    n > 0 && (
      <span className="num absolute -right-2.5 -top-1.5 rounded-full bg-accent px-1.5 text-[9px] font-semibold leading-4 text-white ring-2 ring-[var(--bg)]">
        {n > 99 ? "99+" : n}
      </span>
    );

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="glass-raised absolute inset-x-3 bottom-24 overflow-hidden p-1.5 pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {MORE.map((m) => {
              const Icon = NAV_ICONS[m.icon];
              const active = pathname.startsWith(m.href);
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
                    active ? "bg-accent-soft font-medium text-accent" : "text-ink-dim active:bg-accent-soft/50"
                  )}
                >
                  <Icon size={19} /> {m.label}
                </Link>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t border-line px-2 pt-1">
              <button
                className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm text-ink-dim"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
                {resolvedTheme === "dark" ? "Light" : "Dark"}
              </button>
              <a
                href={HELP_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm text-ink-dim"
              >
                <IconHelp size={18} /> Help
              </a>
              <button
                className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm text-ink-faint"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <IconSignOut size={18} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Panel */}
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* iOS 18 Dynamic Island dual-pill floating tab bar */}
      <div
        className="slide-up fixed inset-x-3 bottom-3 z-40 flex items-end gap-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {/* Primary pill — navigation tabs */}
        <nav className="liquid-pill flex flex-1 items-stretch justify-around">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            const Icon = NAV_ICONS[t.icon];
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2.5 text-[10px] font-medium transition-all",
                  active
                    ? "text-accent bg-accent-soft/40"
                    : "text-ink-faint active:scale-95"
                )}
              >
                <span className="relative">
                  <Icon size={21} />
                  {t.href === "/discover" && badge(discoverCount)}
                  {t.href === "/outreach" && badge(outreachCount)}
                </span>
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Secondary pill — bell + more */}
        <div className="liquid-pill flex items-stretch gap-0.5">
          <button
            onClick={() => setNotifOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-[20px] px-3.5 py-2.5 text-[10px] font-medium transition-all",
              notifOpen ? "text-accent bg-accent-soft/40" : "text-ink-faint active:scale-95"
            )}
          >
            <IconBell size={21} />
            <span>Alerts</span>
          </button>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-[20px] px-3.5 py-2.5 text-[10px] font-medium transition-all",
              moreActive || moreOpen ? "text-accent bg-accent-soft/40" : "text-ink-faint active:scale-95"
            )}
          >
            <IconMore size={21} />
            <span>More</span>
          </button>
        </div>
      </div>
    </>
  );
}
