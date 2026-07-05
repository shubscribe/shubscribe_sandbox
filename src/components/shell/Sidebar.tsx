"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn, monogram } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: "◉", key: "1" },
  { href: "/applications", label: "Applications", icon: "▦", key: "2" },
  { href: "/discover", label: "Discover", icon: "◈", key: "3" },
  { href: "/outreach", label: "Outreach", icon: "✉", key: "4" },
  { href: "/tasks", label: "Tasks", icon: "☑", key: "5" },
  { href: "/contacts", label: "Contacts", icon: "☺", key: "6" },
  { href: "/analytics", label: "Analytics", icon: "◔", key: "7" },
  { href: "/settings", label: "Settings", icon: "⚙", key: "8" },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="glass-pill flex h-9 w-9 items-center justify-center text-sm text-ink-dim transition hover:text-ink"
      title="Toggle theme"
      aria-label="Toggle light/dark theme"
    >
      {mounted ? (resolvedTheme === "dark" ? "☀" : "☾") : "◐"}
    </button>
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
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-lg">
            🚀
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Mission Control</div>
            <div className="text-[11px] text-ink-faint">job tracker</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-dim hover:bg-accent-soft/50 hover:text-ink"
                )}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
                {item.href === "/discover" && discoverCount > 0 && (
                  <span className="num rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
                    {discoverCount}
                  </span>
                )}
                {item.href === "/outreach" && outreachCount > 0 && (
                  <span className="num rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
                    {outreachCount}
                  </span>
                )}
                <kbd className="ml-auto text-[10px] text-ink-faint">{item.key}</kbd>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-ink-faint transition hover:text-ink"
            >
              Sign out
            </button>
          </div>
          <div className="glass-pill flex items-center gap-2.5 p-2">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {monogram(name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{name}</div>
              <div className="truncate text-[10px] text-ink-faint">{email}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
