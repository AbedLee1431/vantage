import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisSection } from "@/lib/ai";
import { cn } from "@/lib/utils";

/**
 * Evidence-first rendering (UI-Design evidence blocks, FR-COMP-03).
 * Fixed order: Observed → Calculated → Interpretation → Assumption →
 * Needs validation. Never mixes them.
 */

const confidenceStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-500/20",
  medium: "bg-amber-50 text-amber-800 ring-amber-600/20",
  high: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
};

export function EvidenceBlock({ section }: { section: AnalysisSection }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{section.title}</CardTitle>
          <Badge className={cn(confidenceStyles[section.confidence] ?? confidenceStyles.low)}>
            {section.confidence} confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.observed.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Observed
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
              {section.observed.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {section.calculated.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Calculated
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
              {section.calculated.map((c, i) => (
                <li key={i} className="tabular-nums">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-md bg-accent-100/50 px-3 py-2 ring-1 ring-inset ring-accent-600/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
            AI interpretation
          </p>
          <p className="mt-1 text-sm text-slate-800">{section.interpretation}</p>
        </div>
        {section.assumption ? (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Assumption: </span>
            {section.assumption}
          </p>
        ) : null}
        {section.needsValidation ? (
          <p className="text-sm text-amber-800">
            <span className="font-medium">Needs validation: </span>
            {section.needsValidation}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function JobStatusPill({ status }: { status: string }) {
  const style =
    status === "done"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
      : status === "failed"
        ? "bg-red-50 text-red-700 ring-red-600/20"
        : "bg-amber-50 text-amber-800 ring-amber-600/20";
  return (
    <Badge className={cn(style)}>
      {status === "running" || status === "queued" ? (
        <span
          className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {status}
    </Badge>
  );
}
