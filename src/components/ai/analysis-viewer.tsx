import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { AdAnalysisResult, CompetitorAnalysisResult, EvidenceRef } from "@/lib/ai";
import type { Provenance } from "@/generated/client";
import { formatDate } from "@/lib/format";
import { EvidenceBlock } from "./evidence";

export type AnalysisView = {
  id: string;
  kind: "ad" | "competitor";
  targetRef: string;
  targetName: string;
  targetUrl: string;
  provider: string;
  model: string;
  provenance: Provenance;
  result: AdAnalysisResult | CompetitorAnalysisResult;
  evidence: EvidenceRef[];
  createdAt: string;
  cached?: boolean;
};

/** Full persisted analysis view (server- and client-renderable). */
export function AnalysisViewer({ analysis }: { analysis: AnalysisView }) {
  const result = analysis.result;
  if (!result || !Array.isArray(result.sections)) {
    return (
      <EmptyState title="Unusable analysis" description="The stored result has no sections." />
    );
  }
  const angle = "angle" in result ? result.angle : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge provenance={analysis.provenance as "demo" | "ai"} />
        <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">
          {analysis.provider} · {analysis.model}
        </Badge>
        <span className="text-xs text-slate-400">
          {analysis.cached ? "Served from cache · " : ""}Generated {formatDate(analysis.createdAt)}
        </span>
      </div>

      {angle ? (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">
              Marketing angle: <span className="font-semibold text-slate-900">{angle}</span>
              {"angleEvidence" in result && result.angleEvidence.length > 0 ? (
                <span className="text-slate-500"> ({result.angleEvidence.join(", ")})</span>
              ) : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {result.sections.map((s) => (
        <EvidenceBlock key={s.key} section={s} />
      ))}

      {result.disclaimers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Disclaimers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              {result.disclaimers.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {analysis.evidence.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sources ({analysis.evidence.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {analysis.evidence.map((r, i) => (
                <li key={`${r.type}-${r.id}-${i}`} className="text-slate-600">
                  <Badge className="mr-2 bg-slate-100 text-slate-600 ring-slate-500/20">
                    {r.type}
                  </Badge>
                  {r.label}{" "}
                  <span className="font-mono text-xs text-slate-400">({r.id.slice(0, 8)}…)</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Every cited record was verified to exist in your workspace at analysis time.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-sm">
        <Link href={analysis.targetUrl} className="font-medium text-accent-700 hover:underline">
          Back to {analysis.targetName}
        </Link>
      </p>
    </div>
  );
}
