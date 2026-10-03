import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { getDashboardData } from "@/modules/dashboard/queries";
import { listAnalyses } from "@/modules/ai/queries";
import { getBillingSummary } from "@/server/billing/subscriptions";

export const metadata: Metadata = { title: "Dashboard" };

const changeLabels: Record<string, string> = {
  new_product: "New product",
  removed_product: "Removed product",
  new_ad: "New ad",
  ad_activity_change: "Ad activity",
  price_change: "Price change",
  landing_page_change: "Landing page",
  review_change: "Review",
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { counts, recentProducts, recentAds, recentChanges } = data;

  const stats = [
    { label: "Stores tracked", value: counts.stores, hint: "Across your workspace" },
    { label: "Products", value: counts.products, hint: "In the demo catalog" },
    { label: "Ads observed", value: counts.ads, hint: "Across platforms" },
    { label: "Competitors", value: counts.competitors, hint: "On your radar" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Dashboard</h1>
        <ProvenanceBadge provenance="demo" />
      </div>

      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">{s.value}</p>
              <p className="mt-1 text-xs text-slate-400">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent discoveries</CardTitle>
                <CardDescription>Latest products in your workspace</CardDescription>
              </div>
              <Link
                href="/products"
                className="shrink-0 text-sm font-medium text-accent-700 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentProducts.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="Products you discover will appear here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentProducts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {p.storeName} · {p.category}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ProvenanceBadge provenance={p.provenance} />
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatCurrency(p.price, p.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent ads</CardTitle>
                <CardDescription>Latest advertising activity observed</CardDescription>
              </div>
              <Link
                href="/ads"
                className="shrink-0 text-sm font-medium text-accent-700 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentAds.length === 0 ? (
              <EmptyState title="No ads yet" description="Observed ads will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentAds.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {a.advertiserName} · {a.platform} · {a.format}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ProvenanceBadge provenance={a.provenance} />
                      <Badge
                        className={
                          a.status === "active"
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                            : "bg-slate-100 text-slate-600 ring-slate-500/20"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Watchlist changes</CardTitle>
          <CardDescription>What changed recently across tracked entities</CardDescription>
        </CardHeader>
        <CardContent>
          {recentChanges.length === 0 ? (
            <EmptyState
              title="No changes detected"
              description="New products, ads, prices, and reviews will surface here."
            />
          ) : (
            <ul className="space-y-3">
              {recentChanges.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <Badge className="mt-0.5 shrink-0 bg-slate-100 text-slate-700 ring-slate-500/20">
                    {changeLabels[c.type] ?? c.type}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700">{c.summary}</p>
                    <p className="text-xs text-slate-400">{timeAgo(c.detectedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>AI insights</CardTitle>
              <CardDescription>Evidence-grounded, persisted analyses</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link href="/reports" className="text-sm font-medium text-accent-700 hover:underline">
                View reports
              </Link>
              <Link href="/analyst" className="text-sm font-medium text-accent-700 hover:underline">
                Open analyst
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AiInsightsPreview />
        </CardContent>
      </Card>

      <BillingPreview />
    </div>
  );
}

async function AiInsightsPreview() {
  const analyses = await listAnalyses();
  const recent = analyses.slice(0, 3);
  if (recent.length === 0) {
    return (
      <EmptyState
        title="No analyses yet"
        description="Run AI ad analysis from any ad page, a competitor breakdown from any store, or ask the analyst."
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {recent.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <Link
              href={`/analyses/${a.id}`}
              className="truncate text-sm font-medium text-slate-900 hover:underline"
            >
              {a.kind === "ad" ? "Ad analysis" : "Competitor analysis"} · {a.targetName}
            </Link>
            <p className="text-xs text-slate-500">
              {a.provider} · {a.model} · {formatDate(a.createdAt)}
            </p>
          </div>
          <ProvenanceBadge provenance={a.provenance} />
        </li>
      ))}
    </ul>
  );
}

async function BillingPreview() {
  const { entitlements, billingConfigured } = await getBillingSummary();
  const used = entitlements.usage.ai_analysis ?? 0;
  const limit = entitlements.limits.ai_analysis;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Plan & usage</CardTitle>
            <CardDescription>
              {entitlements.planName} · {used}/{limit} AI analyses used ({entitlements.period})
              {!billingConfigured ? " · demo billing (Stripe not configured)" : ""}
            </CardDescription>
          </div>
          <Link
            href="/billing"
            className="shrink-0 text-sm font-medium text-accent-700 hover:underline"
          >
            {entitlements.isPro ? "Manage billing" : "Upgrade"}
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}
