import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { SaveButton } from "@/components/discovery/save-button";
import { AddToList } from "@/components/discovery/add-to-list";
import { AnalyzeButton } from "@/components/ai/analyze-button";
import { formatCurrency } from "@/lib/format";
import { getStore } from "@/modules/discovery/queries";
import { getSaveState } from "@/modules/watchlists/queries";
import { getAIStatus } from "@/server/ai/providers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const store = await getStore(id);
  return { title: store ? store.name : "Store not found" };
}

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore(id);
  if (!store) notFound();
  const [{ saved }, status] = await Promise.all([
    getSaveState("store", id),
    Promise.resolve(getAIStatus()),
  ]);
  const providerLabel = status.active === "live" ? `Live · ${status.model}` : "Demo AI";

  const overview: [string, string][] = [
    ["Domain", store.domain],
    ["Category", store.category],
    ["Country", store.country],
    ["Platform", store.platform],
    ["Products", `${store.productCount} · observed`],
    ["Ads observed", `${store.adCount} · observed`],
    ["Landing pages", `${store.landingPageCount} · observed`],
    ["Reviews", `${store.reviewCount} · observed`],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/stores"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All stores
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{store.name}</h1>
            <ProvenanceBadge provenance={store.provenance} />
          </div>
          <a
            href={`https://${store.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            {store.domain} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <SaveButton itemType="store" refId={store.id} initialSaved={saved} />
          <AddToList itemType="store" refId={store.id} />
        </div>
      </div>

      <AnalyzeButton
        kind="competitor"
        targetId={store.id}
        targetName={store.name}
        targetUrl={`/stores/${store.id}`}
        analyzeUrl="/api/ai/competitors/analyze"
        providerLabel={providerLabel}
      />

      {store.description ? <p className="max-w-3xl text-slate-700">{store.description}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {overview.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2.5"
              >
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="text-right text-sm font-medium tabular-nums text-slate-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3">
            <Link
              href={`/customer-intelligence?storeId=${store.id}`}
              className="text-sm font-medium text-accent-700 hover:underline"
            >
              View customer reviews
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products ({store.productCount})</CardTitle>
          <CardDescription>Associated with this store</CardDescription>
        </CardHeader>
        <CardContent>
          {store.products.length === 0 ? (
            <EmptyState
              title="No products"
              description="No products are associated with this store yet."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {store.products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/products/${p.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{p.category}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                    {formatCurrency(p.price, p.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advertising ({store.adCount})</CardTitle>
          <CardDescription>
            Observed ads · creative analysis arrives in Phase 4 ·{" "}
            <Link
              href={`/ads?storeId=${store.id}`}
              className="font-medium text-accent-700 hover:underline"
            >
              view all
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {store.ads.length === 0 ? (
            <EmptyState
              title="No ads observed"
              description="No ads are linked to this store yet."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {store.ads.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ads/${a.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {a.advertiserName} · {a.platform} · {a.format}
                    </p>
                  </div>
                  <Badge
                    className={
                      a.status === "active"
                        ? "shrink-0 bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                        : "shrink-0 bg-slate-100 text-slate-600 ring-slate-500/20"
                    }
                  >
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
