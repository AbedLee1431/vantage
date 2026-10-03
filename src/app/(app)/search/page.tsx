import type { Metadata } from "next";
import Link from "next/link";
import { ProvenanceBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SaveButton } from "@/components/discovery/save-button";
import { globalSearch, type SearchResultItem } from "@/modules/discovery/queries";
import { getSaveState } from "@/modules/watchlists/queries";
import { checkUsageLimit, recordUsage } from "@/server/billing/subscriptions";
import { tenantDb } from "@/server/db/tenant";

export const metadata: Metadata = { title: "Search" };

const typeLabels: Record<SearchResultItem["type"], string> = {
  product: "Products",
  store: "Stores",
  advertiser: "Advertisers",
  competitor: "Competitors",
};

async function ResultRow({ item }: { item: SearchResultItem }) {
  // Offer quick-save directly from search results for these types.
  const showSave = item.type === "advertiser" || item.type === "competitor";
  const { saved } = showSave ? await getSaveState(item.type, item.id) : { saved: false };
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        {item.url ? (
          <Link
            href={item.url}
            className="truncate text-sm font-medium text-slate-900 hover:underline"
          >
            {item.name}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
        )}
        <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ProvenanceBadge provenance={item.provenance} />
        {showSave ? <SaveButton itemType={item.type} refId={item.id} initialSaved={saved} /> : null}
      </div>
    </li>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  if (!q) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Search</h1>
        <Card>
          <CardContent>
            <form action="/search" method="get" className="flex gap-2">
              <Field label="Search everything" htmlFor="q" className="flex-1">
                <Input
                  id="q"
                  name="q"
                  type="search"
                  placeholder="Products, stores, advertisers, competitors…"
                  autoComplete="off"
                />
              </Field>
              <div className="flex items-end">
                <Button type="submit">Search</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <EmptyState
          title="Search across your workspace"
          description="Products, stores, advertisers, and tracked competitors. Or browse products and stores directly."
        />
      </div>
    );
  }

  const { results } = await globalSearch({ q });
  // Meter user-initiated searches (AI tool searches bypass this page).
  try {
    const { organizationId } = await tenantDb();
    const checked = await checkUsageLimit(organizationId, "search");
    if (!("error" in checked) && checked.allowed) {
      await recordUsage(organizationId, "search");
    }
  } catch {
    // Usage metering never blocks search results.
  }
  const groups = (["product", "store", "advertiser", "competitor"] as const).map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">
          Results for &ldquo;{q}&rdquo;
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {results.length} {results.length === 1 ? "match" : "matches"} · simple text search, demo
          data
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try a different term, or browse products and stores."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(
            ({ type, items }) =>
              items.length > 0 && (
                <Card key={type}>
                  <CardHeader>
                    <CardTitle>
                      {typeLabels[type]} ({items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <ResultRow key={`${item.type}-${item.id}`} item={item} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ),
          )}
        </div>
      )}
    </div>
  );
}
