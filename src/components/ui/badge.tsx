import type { ReactNode } from "react";
import type { Provenance } from "@/generated/client";
import { cn } from "@/lib/utils";

/**
 * Provenance & evidence labels (docs/UI-Design.md §3). Demo content is violet —
 * visually distinct from verified data — and AI content is always explicit.
 */

const provenanceStyles: Record<Provenance, string> = {
  demo: "bg-demo-100 text-demo-700 ring-demo-600/20",
  mock: "bg-slate-100 text-slate-700 ring-slate-500/20",
  estimated: "bg-amber-50 text-amber-800 ring-amber-600/20",
  calculated: "bg-sky-50 text-sky-800 ring-sky-600/20",
  external: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  ai: "bg-accent-100 text-accent-700 ring-accent-600/20",
  user: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

const provenanceLabels: Record<Provenance, string> = {
  demo: "Demo data",
  mock: "Mock",
  estimated: "Estimated",
  calculated: "Calculated",
  external: "External",
  ai: "AI-generated",
  user: "Provided by you",
};

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <Badge className={cn(provenanceStyles[provenance], className)}>
      {provenanceLabels[provenance]}
    </Badge>
  );
}
