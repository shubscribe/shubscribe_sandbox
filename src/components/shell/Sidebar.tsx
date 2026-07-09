"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn, monogram } from "@/lib/utils";
import { NAV_ICONS, type NavIconName, IconSun, IconMoon, IconSignOut, IconHelp, IconSettings, IconBell } from "@/components/ui/icons";
import NotificationPanel from "@/components/shell/NotificationPanel";

const NAV: { href: string; label: string; icon: NavIconName; key: string }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", key: "1" },
  { href: "/applications", label: "Applications", icon: "applications", key: "2" },
  { href: "/discover", label: "Discover", icon: "discover", key: "3" },
  { href: "/outreach", label: "Outreach", icon: "outreach", key: "4" },
  { href: "/tasks", label: "Tasks", icon: "tasks", key: "5" },
  { href: "/contacts", label: "Contacts", icon: "contacts", key: "6" },
  { href: "/analytics", label: "Analytics", icon: "analytics", key: "7" },
  { href: "/settings", label: "Settings", icon: "settings", key: "8" },
];

const HELP_URL = "https://github.com/shubscribe/shubscribe_sandbox#readme";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="glass-pill flex h-9 w-9 items-center justify-center text-ink-dim transition hover:text-ink"
      title="Toggle theme"
      aria-label="Toggle light/dark theme"
    >
      {mounted ? (resolvedTheme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />) : null}
    </button>
  );
}

function AccountMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="glass-raised absolute bottom-full left-0 right-0 mb-2 overflow-hidden p-1 pop-in">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-dim transition hover:bg-accent-soft/60 hover:text-ink"
          >
            <IconSettings size={17} /> Settings
          </Link>
          <a
            href={HELP_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-dim transition hover:bg-accent-soft/60 hover:text-ink"
          >
            <IconHelp size={17} /> Help &amp; setup guide
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-dim transition hover:bg-bad/15 hover:text-bad"
          >
            <IconSignOut size={17} /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "glass-pill flex w-full items-center gap-2.5 p-2 text-left transition",
          open && "ring-1 ring-accent/40"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
            {monogram(name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{name}</div>
          <div className="truncate text-[10px] text-ink-faint">{email}</div>
        </div>
        <span className="shrink-0 text-ink-faint">⌄</span>
      </button>
    </div>
  );
}

export function Sidebar({
  name,
  email,
  image,
  discoverCount = 0,
  outreachCount = 0,
}: {
  name: string;
  email: string;
  image: string | null;
  discoverCount?: number;
  outreachCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col p-4 md:flex">
      <div className="glass flex h-full flex-col p-4">
        <div className="mb-7 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-lg">
            🚀
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Mission Control</div>
            <div className="text-[11px] text-ink-faint">job tracker</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = NAV_ICONS[item.icon];
            const badge =
              item.href === "/discover" ? discoverCount : item.href === "/outreach" ? outreachCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-dim hover:bg-accent-soft/50 hover:text-ink"
                )}
              >
                <Icon size={19} className={cn("shrink-0", active ? "text-accent" : "text-ink-faint group-hover:text-ink")} />
                {item.label}
                {badge > 0 && (
                  <span className="num ml-auto rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-white">
                    {badge}
                  </span>
                )}
                {badge === 0 && (
                  <kbd className="ml-auto text-[10px] text-ink-faint opacity-0 transition group-hover:opacity-100">
                    {item.key}
                  </kbd>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-end gap-1.5 px-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
          <AccountMenu name={name} email={email} image={image} />
        </div>
      </div>
    </aside>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass-pill relative flex h-9 w-9 items-center justify-center text-ink-dim transition hover:text-ink"
        title="Notifications"
        aria-label="Open notifications"
      >
        <IconBell size={17} />
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
