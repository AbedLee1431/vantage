import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisViewer, type AnalysisView } from "@/components/ai/analysis-viewer";
import { getAnalysis } from "@/modules/ai/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  return { title: analysis ? `Analysis · ${analysis.targetName}` : "Analysis not found" };
}

export default async function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) notFound();

  const view: AnalysisView = {
    id: analysis.id,
    kind: analysis.kind as "ad" | "competitor",
    targetRef: analysis.targetRef,
    targetName: analysis.targetName,
    targetUrl:
      analysis.kind === "ad" ? `/ads/${analysis.targetRef}` : `/stores/${analysis.targetRef}`,
    provider: analysis.provider,
    model: analysis.model,
    provenance: analysis.provenance,
    result: analysis.result as AnalysisView["result"],
    evidence: analysis.evidence as AnalysisView["evidence"],
    createdAt: analysis.createdAt,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">
        Analysis · {analysis.targetName}
      </h1>
      <AnalysisViewer analysis={view} />
    </div>
  );
}
