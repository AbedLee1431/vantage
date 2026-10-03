import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/discovery/pagination";
import { ProductCard } from "@/components/discovery/product-card";
import { getFilterOptions, listProducts } from "@/modules/discovery/queries";

export const metadata: Metadata = { title: "Products" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [filters, data] = await Promise.all([getFilterOptions(), listProducts(params)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Products</h1>

      <Card>
        <CardContent>
          <form
            action="/products"
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Search" htmlFor="q">
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Name, description, or tag…"
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
                {filters.productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Store" htmlFor="storeId">
              <Select
                id="storeId"
                name="storeId"
                defaultValue={typeof params.storeId === "string" ? params.storeId : ""}
              >
                <option value="">All stores</option>
                {filters.storeList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Min price (USD)" htmlFor="minPrice">
              <Input
                id="minPrice"
                name="minPrice"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                defaultValue={typeof params.minPrice === "string" ? params.minPrice : ""}
              />
            </Field>
            <Field label="Max price (USD)" htmlFor="maxPrice">
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min={0}
                step="0.01"
                placeholder="No max"
                defaultValue={typeof params.maxPrice === "string" ? params.maxPrice : ""}
              />
            </Field>
            <Field label="Sort by" htmlFor="sort">
              <Select
                id="sort"
                name="sort"
                defaultValue={typeof params.sort === "string" ? params.sort : "newest"}
              >
                <option value="newest">Newest first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </Select>
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">Apply filters</Button>
              <Link
                href="/products"
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
          title="No products match these filters"
          description="Try a different search term or clear the filters."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <Pagination
        path="/products"
        searchParams={params}
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
      />
    </div>
  );
}
