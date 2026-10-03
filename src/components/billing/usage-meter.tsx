import { cn } from "@/lib/utils";

/** Monthly usage meter (used / limit with remaining). */
export function UsageMeter({
  label,
  used,
  limit,
  className,
}: {
  label: string;
  used: number;
  limit: number;
  className?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = used >= limit;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs tabular-nums text-slate-500">
          {used} / {limit} · {Math.max(0, limit - used)} left
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label} usage`}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={cn("h-full rounded-full", over ? "bg-red-500" : "bg-accent-600")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
