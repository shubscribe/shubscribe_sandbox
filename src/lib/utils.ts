export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatMoney(n: number | null | undefined, currency = "USD") {
  if (n == null) return null;
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "INR" ? "₹" : `${currency} `;
  if (n >= 1000) return `${sym}${Math.round(n / 1000)}k`;
  return `${sym}${n}`;
}

export function salaryLabel(min?: number | null, max?: number | null, currency?: string | null) {
  const c = currency ?? "USD";
  if (min != null && max != null) return `${formatMoney(min, c)}–${formatMoney(max, c)}`;
  if (min != null) return `${formatMoney(min, c)}+`;
  if (max != null) return `up to ${formatMoney(max, c)}`;
  return null;
}

export function timeAgo(date: Date | number | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "number" ? date : date.getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function daysSince(date: Date | number | null | undefined): number {
  if (!date) return 0;
  const d = typeof date === "number" ? date : date.getTime();
  return Math.floor((Date.now() - d) / 86400000);
}

export function faviconUrl(siteUrl: string | null | undefined) {
  if (siteUrl) {
    try {
      const host = new URL(siteUrl).hostname;
      // job boards don't represent the company; skip to monogram for those
      const boards = ["linkedin", "indeed", "ziprecruiter", "dice", "glassdoor", "greenhouse", "lever", "wellfound", "ashbyhq", "workday", "myworkdayjobs"];
      if (!boards.some((b) => host.includes(b))) {
        return `https://icons.duckduckgo.com/ip3/${host}.ico`;
      }
    } catch {
      /* fall through to monogram */
    }
  }
  return null;
}

export function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export const JOB_TYPES = ["full-time", "part-time", "contract", "internship"] as const;
export const INTERVIEW_FORMATS = ["video", "phone", "onsite"] as const;
export const INTERVIEW_OUTCOMES = ["pending", "passed", "failed", "cancelled"] as const;

export const STAGE_COLORS = [
  "#8b8bf5",
  "#5aa9e6",
  "#2fbfa4",
  "#e09b3d",
  "#ef6292",
  "#c4b5fd",
  "#9aa5c9",
  "#7d87b0",
];
