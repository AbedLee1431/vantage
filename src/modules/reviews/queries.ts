import { parseFilters, reviewFilterSchema } from "@/lib/validation";
import { computeInsights } from "@/lib/reviews";
import { DemoReviewProvider } from "@/server/providers/demo";
import { tenantDb } from "@/server/db/tenant";

/**
 * Review queries (Phase 5). Reads through the Demo review provider;
 * aggregations compute live from observed rows (labeled Calculated).
 */

function reviewsProvider(organizationId: string) {
  return new DemoReviewProvider(organizationId);
}

export async function listReviews(rawFilters: unknown) {
  const { organizationId } = await tenantDb();
  const filters = parseFilters(reviewFilterSchema, rawFilters);
  const { items, total, page, pageSize, totalPages } =
    await reviewsProvider(organizationId).list(filters);
  return {
    items: items.map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: r.date,
      source: r.source,
      productId: r.productId,
      productName: r.product?.name ?? null,
      storeId: r.storeId,
      storeName: r.store?.name ?? null,
      provenance: r.provenance,
    })),
    total,
    page,
    pageSize,
    totalPages,
    source: "demo-seed" as const,
  };
}

export type ReviewScope = { productId?: string; storeId?: string };

export async function getReviewInsights(scope: ReviewScope = {}) {
  const { organizationId } = await tenantDb();
  const provider = reviewsProvider(organizationId);
  // Bounded full-scope fetch for aggregation (demo scale; paginated lists stay separate).
  const { items } = await provider.list({
    productId: scope.productId,
    storeId: scope.storeId,
    sort: "newest",
    page: 1,
    pageSize: 500,
  });
  const insights = computeInsights(
    items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: r.date,
      productName: r.product?.name ?? null,
      storeName: r.store?.name ?? null,
    })),
  );
  return {
    scope,
    insights,
    reviewIds: items.map((r) => r.id),
    provenance: "calculated" as const,
    sourceProvenance: "demo" as const,
  };
}

export async function getReviewFilterOptions() {
  const { db } = await tenantDb();
  const [products, stores] = await Promise.all([
    db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { products, stores };
}
