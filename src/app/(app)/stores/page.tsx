import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/discovery/pagination";
import { StoreCard } from "@/components/discovery/store-card";
import { getFilterOptions, listStores } from "@/modules/discovery/queries";

export const metadata: Metadata = { title: "Stores" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [filters, data] = await Promise.all([getFilterOptions(), listStores(params)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Stores</h1>

      <Card>
        <CardContent>
          <form action="/stores" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Search" htmlFor="q">
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Name or domain…"
                defaultValue={typeof params.q === "string" ? params.q : ""}
              />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select
                id="category"
                name="category"
                defaultValue={typeof params.category === "string" ? params.category : ""}
              >
                <option value="">All categories</option>
                {filters.storeCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Country" htmlFor="country">
              <Select
                id="country"
                name="country"
                defaultValue={typeof params.country === "string" ? params.country : ""}
              >
                <option value="">All countries</option>
                {filters.countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Platform" htmlFor="platform">
              <Select
                id="platform"
                name="platform"
                defaultValue={typeof params.platform === "string" ? params.platform : ""}
              >
                <option value="">All platforms</option>
                {filters.platforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort by" htmlFor="sort">
              <Select
                id="sort"
                name="sort"
                defaultValue={typeof params.sort === "string" ? params.sort : "name"}
              >
                <option value="name">Name A–Z</option>
                <option value="newest">Newest first</option>
                <option value="products">Most products</option>
              </Select>
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <Button type="submit">Apply filters</Button>
              <Link
                href="/stores"
                className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <EmptyState
          title="No stores match these filters"
          description="Try a different search term or clear the filters."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((s) => (
            <StoreCard key={s.id} store={s} />
          ))}
        </div>
      )}

      <Pagination
        path="/stores"
        searchParams={params}
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
      />
    </div>
  );
}
