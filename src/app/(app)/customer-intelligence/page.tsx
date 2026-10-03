import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/discovery/pagination";
import { AnalyzeButton } from "@/components/ai/analyze-button";
import { formatDate, timeAgo } from "@/lib/format";
import { getReviewFilterOptions, getReviewInsights, listReviews } from "@/modules/reviews/queries";
import { getProduct } from "@/modules/discovery/queries";
import { getStore } from "@/modules/discovery/queries";
import { getAIStatus } from "@/server/ai/providers";

export const metadata: Metadata = { title: "Customer Intelligence" };

type SearchParams = Record<string, string | string[] | undefined>;

function str(params: SearchParams, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export default async function CustomerIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const productId = str(params, "productId") || undefined;
  const storeId = str(params, "storeId") || undefined;

  // Validate scope (404 on unknown ids, never silent empties for bad links).
  const [scopedProduct, scopedStore] = await Promise.all([
    productId ? getProduct(productId) : Promise.resolve(null),
    storeId ? getStore(storeId) : Promise.resolve(null),
  ]);
  if ((productId && !scopedProduct) || (storeId && !scopedStore)) notFound();
  const scopeLabel = scopedProduct
    ? `Reviews for ${scopedProduct.name}`
    : scopedStore
      ? `Reviews for ${scopedStore.name}`
      : "All reviews";
  const scopeQuery = productId ? `?productId=${productId}` : storeId ? `?storeId=${storeId}` : "";
  const backUrl = `/customer-intelligence${scopeQuery}`;

  const status = getAIStatus();
  const providerLabel = status.active === "live" ? `Live · ${status.model}` : "Demo AI";

  const [{ insights, reviewIds }, list, filters] = await Promise.all([
    getReviewInsights({ productId, storeId }),
    listReviews({
      ...params,
      ...(productId ? { productId } : {}),
      ...(storeId ? { storeId } : {}),
    }),
    getReviewFilterOptions(),
  ]);
  void reviewIds;

  const maxBucket = Math.max(1, ...insights.sentiment.distribution.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Customer Intelligence</h1>
        <ProvenanceBadge provenance="calculated" />
        <ProvenanceBadge provenance="demo" />
      </div>
      <p className="max-w-3xl text-sm text-slate-600">
        {scopeLabel} · sentiment and themes computed from observed rows (keyword counts + rating
        math, not NLP). AI prose summaries are generated on demand below.
      </p>
      {scopedProduct || scopedStore ? (
        <p className="text-sm">
          <Link
            href="/customer-intelligence"
            className="font-medium text-accent-700 hover:underline"
          >
            View all reviews
          </Link>
          {scopedProduct ? (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/products/${scopedProduct.id}`}
                className="font-medium text-accent-700 hover:underline"
              >
                Back to product
              </Link>
            </>
          ) : null}
          {scopedStore ? (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/stores/${scopedStore.id}`}
                className="font-medium text-accent-700 hover:underline"
              >
                Back to store
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-500">Reviews</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">
              {insights.sentiment.count}
            </p>
            <p className="mt-1 text-xs text-slate-400">Observed rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-500">Average rating</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">
              {insights.sentiment.avg !== null ? insights.sentiment.avg.toFixed(1) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Calculated mean</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-500">Negative share</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">
              {insights.sentiment.count
                ? `${Math.round((insights.sentiment.negative / insights.sentiment.count) * 100)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Rated 2★ or below</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rating distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {insights.sentiment.count === 0 ? (
            <p className="text-sm text-slate-500">No reviews in this scope.</p>
          ) : (
            <ul className="space-y-2">
              {insights.sentiment.distribution.map((d) => (
                <li key={d.stars} className="flex items-center gap-3 text-sm">
                  <span className="w-8 tabular-nums text-slate-600">{d.stars}★</span>
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                    role="img"
                    aria-label={`${d.count} reviews at ${d.stars} stars`}
                  >
                    <div
                      className="h-full rounded-full bg-accent-600"
                      style={{ width: `${Math.round((d.count / maxBucket) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-slate-600">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Positive themes</CardTitle>
            <CardDescription>From 4–5★ reviews (keyword matches)</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.positiveThemes.length === 0 ? (
              <p className="text-sm text-slate-500">No positive themes detected.</p>
            ) : (
              <ul className="space-y-3">
                {insights.positiveThemes.map((t) => (
                  <li key={t.theme}>
                    <p className="text-sm font-medium text-slate-900">
                      {t.theme} <span className="font-normal text-slate-500">×{t.count}</span>
                    </p>
                    {t.examples.map((e) => (
                      <p key={e.id} className="mt-0.5 truncate text-xs text-slate-500">
                        ★{e.rating} — {e.quote.slice(0, 100)}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pain points</CardTitle>
            <CardDescription>From 1–3★ reviews (keyword matches)</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.negativeThemes.length === 0 ? (
              <p className="text-sm text-slate-500">No recurring complaints detected.</p>
            ) : (
              <ul className="space-y-3">
                {insights.negativeThemes.map((t) => (
                  <li key={t.theme}>
                    <p className="text-sm font-medium text-slate-900">
                      {t.theme} <span className="font-normal text-slate-500">×{t.count}</span>
                    </p>
                    {t.examples.map((e) => (
                      <p key={e.id} className="mt-0.5 truncate text-xs text-slate-500">
                        ★{e.rating} — {e.quote.slice(0, 100)}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(insights.featureRequests.length > 0 || insights.useContexts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Requests & contexts</CardTitle>
            <CardDescription>Explicit asks and mentioned use contexts</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {insights.featureRequests.map((t) => (
              <Badge key={t.theme} className="bg-accent-100 text-accent-700 ring-accent-600/20">
                requests ×{t.count}
              </Badge>
            ))}
            {insights.useContexts.map((t) => (
              <Badge key={t.theme} className="bg-slate-100 text-slate-600 ring-slate-500/20">
                {t.theme} ×{t.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI pain-point summary</CardTitle>
          <CardDescription>Persisted, cached, evidence-linked (job-backed)</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyzeButton
            kind="review_summary"
            targetId={productId ?? storeId ?? "org"}
            targetName={scopeLabel}
            targetUrl={backUrl}
            analyzeUrl="/api/ai/reviews/summarize"
            providerLabel={providerLabel}
            requestBody={{ ...(productId ? { productId } : {}), ...(storeId ? { storeId } : {}) }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews ({list.total})</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/customer-intelligence"
            method="get"
            className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {productId ? <input type="hidden" name="productId" value={productId} /> : null}
            {storeId ? <input type="hidden" name="storeId" value={storeId} /> : null}
            <Field label="Keyword" htmlFor="q">
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Text or author…"
                defaultValue={str(params, "q")}
              />
            </Field>
            {!productId && !storeId ? (
              <>
                <Field label="Product" htmlFor="productId">
                  <Select id="productId" name="productId" defaultValue={str(params, "productId")}>
                    <option value="">All products</option>
                    {filters.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Store" htmlFor="storeId">
                  <Select id="storeId" name="storeId" defaultValue={str(params, "storeId")}>
                    <option value="">All stores</option>
                    {filters.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            <Field label="Rating" htmlFor="rating">
              <Select id="rating" name="rating" defaultValue={str(params, "rating")}>
                <option value="">Any rating</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r}★
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort by" htmlFor="sort">
              <Select id="sort" name="sort" defaultValue={str(params, "sort") || "newest"}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </Select>
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit">Apply filters</Button>
              <Link
                href="/customer-intelligence"
                className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Clear
              </Link>
            </div>
          </form>

          {list.items.length === 0 ? (
            <EmptyState
              title="No reviews match"
              description="Try different filters, or scope to another product or store."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.items.map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {r.title ?? "(no title)"}{" "}
                      <span className="font-normal tabular-nums text-amber-600">★{r.rating}</span>
                    </p>
                    <ProvenanceBadge provenance={r.provenance} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{r.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {r.author ?? "Anonymous"}
                    {r.productName ? ` · ${r.productName}` : ""}
                    {r.storeName ? ` · ${r.storeName}` : ""} · {formatDate(r.date)} ·{" "}
                    {timeAgo(r.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Pagination
        path="/customer-intelligence"
        searchParams={params}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
      />
    </div>
  );
}
