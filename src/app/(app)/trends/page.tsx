import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/badge";
import { TrendBars } from "@/components/discovery/trend-chart";
import { formatDate } from "@/lib/format";
import { getTrends } from "@/modules/discovery/queries";

export const metadata: Metadata = { title: "Trends" };

export default async function TrendsPage() {
  const trends = await getTrends();
  const maxCategory = Math.max(1, ...trends.categories.map((c) => c.total));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Trends</h1>
        <ProvenanceBadge provenance="calculated" />
        <ProvenanceBadge provenance="demo" />
      </div>
      <p className="max-w-3xl text-sm text-slate-600">
        Computed from first-seen dates in the demo dataset (last {trends.weeks} weeks, generated{" "}
        {formatDate(trends.generatedAt)}). Illustrative only — not real-time, not market data.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New products per week</CardTitle>
            <CardDescription>Products entering the dataset, by first-seen week</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendBars
              id="trend-products"
              title="New products per week"
              labels={trends.labels}
              values={trends.productBuckets}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New ads per week</CardTitle>
            <CardDescription>Ads entering the dataset, by first-seen week</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendBars
              id="trend-ads"
              title="New ads per week"
              labels={trends.labels}
              values={trends.adBuckets}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category momentum</CardTitle>
          <CardDescription>
            Products per category · recent = first seen in the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trends.categories.length === 0 ? (
            <p className="text-sm text-slate-500">No category activity in this window.</p>
          ) : (
            <ul className="space-y-3">
              {trends.categories.map((c) => (
                <li key={c.category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">{c.category}</span>
                    <span className="tabular-nums text-slate-500">
                      {c.total} total · {c.recent} recent
                    </span>
                  </div>
                  <div
                    className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
                    role="img"
                    aria-label={`${c.category}: ${c.total} products, ${c.recent} in the last 30 days`}
                  >
                    <div
                      className="h-full rounded-full bg-accent-600"
                      style={{ width: `${Math.round((c.total / maxCategory) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this shows</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {trends.summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
