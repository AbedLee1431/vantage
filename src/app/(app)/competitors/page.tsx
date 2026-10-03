import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ProvenanceBadge } from "@/components/ui/badge";
import { AnalyzeButton } from "@/components/ai/analyze-button";
import { formatDate } from "@/lib/format";
import { getAIStatus } from "@/server/ai/providers";
import { listAnalyses } from "@/modules/ai/queries";
import { listStores } from "@/modules/discovery/queries";

export const metadata: Metadata = { title: "Competitors" };

type SearchParams = Record<string, string | string[] | undefined>;

function str(params: SearchParams, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = getAIStatus();
  const providerLabel = status.active === "live" ? `Live · ${status.model}` : "Demo AI";

  const q = str(params, "q");
  const storeId = str(params, "storeId");
  const [stores, history] = await Promise.all([
    listStores(storeId ? {} : { q: q || undefined, pageSize: 8 }),
    listAnalyses("competitor"),
  ]);
  const picker = storeId ? stores.items.filter((s) => s.id === storeId) : stores.items;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Competitors</h1>

      <Card>
        <CardHeader>
          <CardTitle>Analyze a store</CardTitle>
          <CardDescription>
            Pick a tracked store for the full 11-section evidence-tagged breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/competitors" method="get" className="flex max-w-md gap-2">
            <Field label="Find a store" htmlFor="q" className="flex-1">
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Store name or domain…"
                defaultValue={q}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Search</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {picker.length === 0 ? (
        <EmptyState
          title="No stores found"
          description="Try a different search, or add stores to your workspace first."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {picker.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>
                      <Link href={`/stores/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {s.domain} · {s.category} · {s.productCount} products
                    </CardDescription>
                  </div>
                  <ProvenanceBadge provenance={s.provenance} />
                </div>
              </CardHeader>
              <CardContent>
                <AnalyzeButton
                  kind="competitor"
                  targetId={s.id}
                  targetName={s.name}
                  targetUrl={`/stores/${s.id}`}
                  analyzeUrl="/api/ai/competitors/analyze"
                  providerLabel={providerLabel}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Past analyses ({history.length})</CardTitle>
          <CardDescription>Persisted, reused on repeat requests (cache).</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No competitor analyses yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/analyses/${h.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {h.targetName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {h.provider} · {h.model} · {formatDate(h.createdAt)}
                    </p>
                  </div>
                  <ProvenanceBadge provenance={h.provenance} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
