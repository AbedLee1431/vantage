/**
 * Data presentation helpers (docs/UI-Design.md §8). Money always shows currency;
 * dates show absolute + relative; numbers use tabular figures via CSS.
 */

export function formatCurrency(amount: number | string, currency = "USD"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/** Whole-day ad run duration ("3 days" / "1 day" / "Less than a day"). */
export function formatDurationDays(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "—";
  if (days === 0) return "Less than a day";
  if (days === 1) return "1 day";
  return `${days} days`;
}
