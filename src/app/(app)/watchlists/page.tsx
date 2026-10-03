import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { Pagination } from "@/components/discovery/pagination";
import { SyncButton } from "@/components/monitoring/sync-button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { removeWatchlistItemAction } from "@/modules/watchlists/actions";
import { listWatchlists } from "@/modules/watchlists/queries";
import { acknowledgeAlertAction } from "@/modules/monitoring/actions";
import {
  getLastSync,
  getMonitoringOverview,
  listAlerts,
  listTimeline,
} from "@/modules/monitoring/queries";
import { timeAgo } from "@/lib/format";
import { CreateWatchlistForm } from "./create-form";

export const metadata: Metadata = { title: "Watchlists & Monitoring" };

const typeLabels = {
  product: "Product",
  store: "Store",
  advertiser: "Advertiser",
  competitor: "Competitor",
} as const;

const changeLabels: Record<string, string> = {
  new_product: "New product",
  removed_product: "Removed product",
  new_ad: "New ad",
  ad_activity_change: "Ad activity",
  price_change: "Price change",
  landing_page_change: "Landing page",
  review_change: "Review",
};

const severityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-500/20",
  medium: "bg-amber-50 text-amber-800 ring-amber-600/20",
  high: "bg-red-50 text-red-700 ring-red-600/20",
};

type SearchParams = Record<string, string | string[] | undefined>;

function str(params: SearchParams, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export default async function WatchlistsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const showAll = str(params, "alerts") === "all";
  const [overview, alerts, timeline, watchlists, lastSync] = await Promise.all([
    getMonitoringOverview(),
    listAlerts(showAll),
    listTimeline(params),
    listWatchlists(),
    getLastSync(),
  ]);

  const stats = [
    { label: "Watchlists", value: overview.listCount },
    { label: "Tracked items", value: overview.itemCount },
    { label: "Unacknowledged alerts", value: overview.unackedAlertCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">
          Watchlists & Monitoring
        </h1>
        <ProvenanceBadge provenance="demo" />
      </div>
      <p className="max-w-3xl text-sm text-slate-600">
        Changes are detected by manual syncs against observed data — never real-time, never scraped.
        Every event below corresponds to an actual database difference.
      </p>

      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Sync status</CardTitle>
          <CardDescription>
            {lastSync
              ? `Last synced ${timeAgo(lastSync)}. Manual triggers only — automated scheduling is a future extension.`
              : "Never synced. Trigger a sync to scan for new products, ads, and reviews."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>
                Alerts ({showAll ? alerts.length : overview.unackedAlertCount} shown)
              </CardTitle>
              <CardDescription>Noteworthy changes · acknowledge to clear</CardDescription>
            </div>
            <Link
              href={showAll ? "/watchlists" : "/watchlists?alerts=all"}
              className="shrink-0 text-sm font-medium text-accent-700 hover:underline"
            >
              {showAll ? "Hide acknowledged" : "Show acknowledged"}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <EmptyState
              title={showAll ? "No alerts recorded" : "All caught up"}
              description={
                showAll
                  ? "Alerts appear here when syncs detect changes."
                  : "No unacknowledged alerts. Trigger a sync to check for new changes."
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    {a.acknowledgedAt ? (
                      <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    ) : (
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{a.summary}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <Badge className={severityStyles[a.severity]}>{a.severity}</Badge>
                        <span>{changeLabels[a.type] ?? a.type}</span>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(a.detectedAt)}</span>
                        {a.acknowledgedAt ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-1">
                              <BellOff className="h-3 w-3" aria-hidden /> acknowledged
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {!a.acknowledgedAt ? (
                    <form action={acknowledgeAlertAction} className="shrink-0">
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                        Acknowledge
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity timeline</CardTitle>
          <CardDescription>All recorded changes, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/watchlists" method="get" className="mb-4 flex flex-wrap gap-2">
            <Field label="Change type" htmlFor="type" className="w-48">
              <Select id="type" name="type" defaultValue={str(params, "type")}>
                <option value="">All types</option>
                {Object.entries(changeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entity id" htmlFor="ref" className="w-64">
              <Input
                id="ref"
                name="ref"
                placeholder="Filter by tracked entity…"
                defaultValue={str(params, "ref")}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit">Filter</Button>
              {(str(params, "type") || str(params, "ref")) && (
                <Link
                  href="/watchlists"
                  className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>

          {timeline.items.length === 0 ? (
            <EmptyState
              title="No changes match"
              description="Try a different filter, or trigger a sync to detect new activity."
            />
          ) : (
            <ul className="space-y-3">
              {timeline.items.map((c) => (
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
          <div className="mt-4">
            <Pagination
              path="/watchlists"
              searchParams={params}
              page={timeline.page}
              totalPages={timeline.totalPages}
              total={timeline.total}
            />
          </div>
        </CardContent>
      </Card>

      <CreateWatchlistForm />

      {watchlists.length === 0 ? (
        <EmptyState
          title="No watchlists yet"
          description="Create one above, or save products and stores from their pages to start the default Saved items list."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {watchlists.map((w) => (
            <Card key={w.id}>
              <CardHeader>
                <CardTitle>
                  {w.name} ({w.itemCount})
                </CardTitle>
                {w.name === "Saved items" ? (
                  <CardDescription>Your default list — Save buttons add here.</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                {w.items.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Empty — add items from product or store pages.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {w.items.map((item) => (
                      <li
                        key={item.itemId}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          {item.url ? (
                            <Link
                              href={item.url}
                              className="truncate text-sm font-medium text-slate-900 hover:underline"
                            >
                              {item.name}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-medium text-slate-900">
                              {item.name}
                            </p>
                          )}
                          <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">
                            {typeLabels[item.itemType]}
                          </Badge>
                          <form action={removeWatchlistItemAction}>
                            <input type="hidden" name="itemId" value={item.itemId} />
                            <SubmitButton
                              variant="ghost"
                              size="sm"
                              pendingLabel="…"
                              aria-label={`Remove ${item.name}`}
                              title={`Remove ${item.name}`}
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </SubmitButton>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
