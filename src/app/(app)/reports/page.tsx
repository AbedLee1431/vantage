import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/discovery/pagination";
import { formatDate } from "@/lib/format";
import { listReports } from "@/modules/reports/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const typeLabels: Record<string, string> = {
  competitor: "Competitor",
  product: "Product",
  advertising: "Advertising",
  customer: "Customer",
  trends: "Trends",
  monitoring: "Monitoring",
  combined: "Combined",
};

const statusStyles: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600 ring-slate-500/20",
  running: "bg-amber-50 text-amber-800 ring-amber-600/20",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

type SearchParams = Record<string, string | string[] | undefined>;

function str(params: SearchParams, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await listReports(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Reports</h1>
        <Link
          href="/reports/new"
          className="inline-flex h-10 items-center rounded-md bg-brand-950 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          New report
        </Link>
      </div>

      <Card>
        <CardContent>
          <form action="/reports" method="get" className="flex flex-wrap gap-2">
            <Field label="Type" htmlFor="type" className="w-56">
              <Select id="type" name="type" defaultValue={str(params, "type")}>
                <option value="">All types</option>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit">Filter</Button>
              {str(params, "type") && (
                <Link
                  href="/reports"
                  className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Generate your first report — snapshots freeze data at creation time and stay in history."
        />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {data.items.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/reports/${r.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <Badge className={cn(statusStyles[r.status] ?? statusStyles.queued)}>
                        {r.status}
                      </Badge>
                      <span>{typeLabels[r.type] ?? r.type}</span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(r.createdAt)}</span>
                      {r.provider ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            {r.provider} · {r.model}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <ProvenanceBadge provenance="demo" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Pagination
        path="/reports"
        searchParams={params}
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
      />
    </div>
  );
}
