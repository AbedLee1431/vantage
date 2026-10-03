import type { Metadata } from "next";
import { Archive, ArchiveRestore } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  archiveOpportunityAction,
  restoreOpportunityAction,
} from "@/modules/opportunities/actions";
import { listOpportunities, type OpportunityDTO } from "@/modules/opportunities/queries";
import { getAIStatus } from "@/server/ai/providers";
import { cn } from "@/lib/utils";
import { OpportunityAnalyzeButton } from "./analyze-button";

export const metadata: Metadata = { title: "Opportunities" };

const confidenceStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-500/20",
  medium: "bg-amber-50 text-amber-800 ring-amber-600/20",
  high: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
};

function OpportunityCard({ opportunity }: { opportunity: OpportunityDTO }) {
  const archived = opportunity.status === "archived";
  return (
    <Card className={cn(archived && "opacity-70")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{opportunity.title}</CardTitle>
            <CardDescription>
              {opportunity.provider} · {opportunity.model} ·{" "}
              {new Date(opportunity.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ProvenanceBadge provenance={opportunity.provenance} />
            <Badge className={cn(confidenceStyles[opportunity.confidence])}>
              {opportunity.confidence} confidence
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-700">{opportunity.description}</p>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-accent-700 hover:underline">
            Evidence & supporting data
          </summary>
          <div className="mt-2 space-y-2 text-sm">
            {opportunity.evidence.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5 text-slate-700">
                {opportunity.evidence.map((e, i) => (
                  <li key={i}>
                    <Badge className="mr-1.5 bg-slate-100 text-slate-600 ring-slate-500/20">
                      {e.type}
                    </Badge>
                    {e.label}{" "}
                    <span className="font-mono text-xs text-slate-400">({e.id.slice(0, 8)}…)</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {Object.keys(opportunity.supportingData).length > 0 ? (
              <p className="text-slate-600">
                <span className="font-medium">Data: </span>
                {Object.entries(opportunity.supportingData)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" · ")}
              </p>
            ) : null}
            {opportunity.competitors.length > 0 ? (
              <p className="text-slate-600">
                <span className="font-medium">Competitors observed: </span>
                {opportunity.competitors.map((c) => c.name).join(", ")}
              </p>
            ) : null}
            {opportunity.painPoints.length > 0 ? (
              <p className="text-slate-600">
                <span className="font-medium">Pain points: </span>
                {opportunity.painPoints.map((p) => `${p.theme} ×${p.count}`).join(", ")}
              </p>
            ) : null}
            <p className="text-slate-600">
              <span className="font-medium">Potential differentiation: </span>
              {opportunity.differentiation}
            </p>
          </div>
        </details>

        <form action={archived ? restoreOpportunityAction : archiveOpportunityAction}>
          <input type="hidden" name="id" value={opportunity.id} />
          <SubmitButton
            variant="ghost"
            size="sm"
            pendingLabel={archived ? "Restoring…" : "Archiving…"}
          >
            {archived ? (
              <>
                <ArchiveRestore className="h-4 w-4" aria-hidden /> Restore
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" aria-hidden /> Archive
              </>
            )}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function OpportunitiesPage() {
  const status = getAIStatus();
  const providerLabel = status.active === "live" ? `Live · ${status.model}` : "Demo AI";
  const opportunities = await listOpportunities();
  const open = opportunities.filter((o) => o.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Opportunities</h1>
        <ProvenanceBadge provenance="demo" />
      </div>
      <p className="max-w-3xl text-sm text-slate-600">
        Gaps worth investigating — derived from products, ads, and reviews, each linked to its
        evidence. Leads, never guarantees; validate before acting.
      </p>

      <OpportunityAnalyzeButton providerLabel={providerLabel} />

      {opportunities.length === 0 ? (
        <EmptyState
          title="No opportunities recorded"
          description="Run gap analysis above. If evidence is thin, it will honestly return few or none."
        />
      ) : (
        <div className="space-y-4">
          {open.length > 0 ? (
            <div className="space-y-4">
              {open.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No open opportunities — all archived.</p>
          )}
          {opportunities.some((o) => o.status === "archived") ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Archived
              </h2>
              {opportunities
                .filter((o) => o.status === "archived")
                .map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} />
                ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
