import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PrintButton } from "@/components/reports/print-button";
import { formatDate } from "@/lib/format";
import { getReport, type ReportDetail } from "@/modules/reports/queries";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);
  return { title: report ? report.title : "Report not found" };
}

function SectionView({
  section,
  reportId,
}: {
  section: ReportDetail["sections"][number];
  reportId: string;
}) {
  if (section.kind === "stats") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(section.stats ?? []).map((s) => (
          <div key={s.label} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-brand-950">{s.value}</p>
          </div>
        ))}
      </div>
    );
  }
  if (section.kind === "table") {
    const columns = section.columns ?? [];
    const rows = section.rows ?? [];
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {columns.map((c) => (
                  <th key={c} scope="col" className="px-2 py-2 font-semibold text-slate-700">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-2 text-slate-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a
          href={`/api/reports/${reportId}/csv?section=${encodeURIComponent(section.key)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:underline print:hidden"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Download CSV
        </a>
      </div>
    );
  }
  if (section.kind === "list") {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {(section.items ?? []).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm text-slate-700">{section.text ?? ""}</p>;
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  return (
    <div className="space-y-6 print:space-y-4">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All reports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{report.title}</h1>
            <ProvenanceBadge provenance="demo" />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Generated {formatDate(report.createdAt)}
            {report.provider ? (
              <>
                {" "}
                · {report.provider} · {report.model}
              </>
            ) : null}
            {report.status !== "done" ? (
              <>
                {" "}
                ·{" "}
                <Badge className="bg-amber-50 text-amber-800 ring-amber-600/20">
                  {report.status}
                </Badge>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <Link
            href={`/reports/${report.id}/delete`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </Link>
        </div>
      </div>

      {report.status === "failed" ? (
        <Card>
          <CardContent>
            <p role="alert" className="text-sm text-red-700">
              Generation failed{report.error ? `: ${report.error}` : "."} Create a new report to
              retry — history keeps the failed record for audit.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {report.status === "done" ? (
        <>
          <Card className="border-accent-600/30">
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-slate-800">{report.summary}</p>
              {report.findings.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Key findings
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {report.findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {report.sections.map((section) => (
            <Card key={section.key}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{section.title}</CardTitle>
                  {section.provenance ? (
                    <Badge
                      className={cn(
                        section.provenance === "calculated"
                          ? "bg-sky-50 text-sky-800 ring-sky-600/20"
                          : section.provenance === "ai"
                            ? "bg-accent-100 text-accent-700 ring-accent-600/20"
                            : "bg-demo-100 text-demo-700 ring-demo-600/20",
                      )}
                    >
                      {section.provenance}
                    </Badge>
                  ) : null}
                </div>
                {section.note ? <CardDescription>{section.note}</CardDescription> : null}
              </CardHeader>
              <CardContent>
                <SectionView section={section} reportId={report.id} />
              </CardContent>
            </Card>
          ))}

          {report.disclaimers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Disclaimers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {report.disclaimers.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {report.evidence.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Sources ({report.evidence.length})</CardTitle>
                <CardDescription>Workspace rows this report was built from.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {report.evidence.map((r, i) => (
                    <li key={`${r.type}-${r.id}-${i}`} className="text-slate-600">
                      <Badge className="mr-1.5 bg-slate-100 text-slate-600 ring-slate-500/20">
                        {r.type}
                      </Badge>
                      {r.label}{" "}
                      <span className="font-mono text-xs text-slate-400">
                        ({r.id.slice(0, 8)}…)
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          title={report.status === "failed" ? "Report failed" : "Report not ready"}
          description="It may still be generating — refresh in a moment, or check history."
        />
      )}
    </div>
  );
}
