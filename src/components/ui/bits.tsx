"use client";

import { cn } from "@/lib/utils";

export const inputCls =
  "w-full rounded-xl border border-line bg-raised/60 px-3 py-2 text-sm text-ink placeholder:text-ink-faint";

export const btnPrimary =
  "rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40";

export const btnGhost =
  "rounded-xl border border-line px-4 py-2 text-sm text-ink-dim transition hover:bg-accent-soft/50 hover:text-ink";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-ink-dim">{label}</span>
      {children}
    </label>
  );
}

export function Chip({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className
      )}
      style={
        color
          ? { backgroundColor: `${color}22`, color }
          : { backgroundColor: "var(--accent-soft)", color: "var(--ink-dim)" }
      }
    >
      {children}
    </span>
  );
}

export function Stars({
  value,
  onChange,
  size = "text-sm",
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: string;
}) {
  return (
    <span className={cn("inline-flex", size)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(value === n ? null : n);
          }}
          className={cn(
            "px-[1px] transition",
            (value ?? 0) >= n ? "text-warn" : "text-ink-faint/50",
            onChange && "hover:scale-110"
          )}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function CompanyLogo({
  url,
  company,
  size = 32,
}: {
  url: string | null;
  company: string;
  size?: number;
}) {
  const mono = company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      <span>{mono}</span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-contain p-0.5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );
}
