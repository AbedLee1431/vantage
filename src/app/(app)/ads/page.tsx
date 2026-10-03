import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/discovery/pagination";
import { AdCard } from "@/components/discovery/ad-card";
import { getAdFilterOptions, listAds } from "@/modules/ads/queries";

export const metadata: Metadata = { title: "Ads" };

type SearchParams = Record<string, string | string[] | undefined>;

function str(params: SearchParams, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export default async function AdsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [filters, data] = await Promise.all([getAdFilterOptions(), listAds(params)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Ads</h1>

      <Card>
        <CardContent>
          <form action="/ads" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Keyword" htmlFor="q">
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Title or text…"
                defaultValue={str(params, "q")}
              />
            </Field>
            <Field label="Platform" htmlFor="platform">
              <Select id="platform" name="platform" defaultValue={str(params, "platform")}>
                <option value="">All platforms</option>
                {filters.platforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Advertiser" htmlFor="advertiserId">
              <Select
                id="advertiserId"
                name="advertiserId"
                defaultValue={str(params, "advertiserId")}
              >
                <option value="">All advertisers</option>
                {filters.advertisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.platform}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category (via store)" htmlFor="category">
              <Select id="category" name="category" defaultValue={str(params, "category")}>
                <option value="">All categories</option>
                {filters.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Format" htmlFor="format">
              <Select id="format" name="format" defaultValue={str(params, "format")}>
                <option value="">All formats</option>
                {filters.formats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort by" htmlFor="sort">
              <Select id="sort" name="sort" defaultValue={str(params, "sort") || "newest"}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="longest">Longest running</option>
              </Select>
            </Field>
            <Field label="Min duration (days)" htmlFor="minDuration">
              <Input
                id="minDuration"
                name="minDuration"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                defaultValue={str(params, "minDuration")}
              />
            </Field>
            <Field label="Max duration (days)" htmlFor="maxDuration">
              <Input
                id="maxDuration"
                name="maxDuration"
                type="number"
                min={0}
                step={1}
                placeholder="No max"
                defaultValue={str(params, "maxDuration")}
              />
            </Field>
            <Field label="Running from" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={str(params, "from")} />
            </Field>
            {str(params, "storeId") ? (
              <input type="hidden" name="storeId" value={str(params, "storeId")} />
            ) : null}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">Apply filters</Button>
              <Link
                href="/ads"
                className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Clear
              </Link>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            Date bounds match ads running at any point in the range. Duration is whole days between
            first and last seen.
          </p>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <EmptyState
          title="No ads match these filters"
          description="Try a different keyword or clear the filters."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((a) => (
            <AdCard key={a.id} ad={a} />
          ))}
        </div>
      )}

      <Pagination
        path="/ads"
        searchParams={params}
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
      />
    </div>
  );
}
