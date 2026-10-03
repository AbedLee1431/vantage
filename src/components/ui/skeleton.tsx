import { cn } from "@/lib/utils";

/** Skeleton placeholder matching the layout it stands in for (never a bare spinner). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-slate-200", className)} />;
}
