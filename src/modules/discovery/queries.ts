import {
  parseFilters,
  productFilterSchema,
  searchSchema,
  storeFilterSchema,
} from "@/lib/validation";
import type { Provenance } from "@/generated/client";
import { DemoProductProvider, DemoStoreProvider } from "@/server/providers/demo";
import { createTenantClient, tenantDb } from "@/server/db/tenant";

/**
 * Discovery queries (Phase 2). Reads flow through the Demo providers (spec §24);
 * tenant scoping is enforced by the underlying client; inputs are validated at
 * this boundary (lenient: bad URL params fall back to defaults).
 */

function providers(organizationId: string) {
  return {
    products: new DemoProductProvider(organizationId),
    stores: new DemoStoreProvider(organizationId),
  };
}

export async function listProducts(rawFilters: unknown) {
  const { organizationId } = await tenantDb();
  const filters = parseFilters(productFilterSchema, rawFilters);
  const { items, total, page, pageSize, totalPages } =
    await providers(organizationId).products.list(filters);
  return {
    items: items.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      currency: p.currency,
      storeId: p.storeId,
      storeName: p.store.name,
      storeDomain: p.store.domain,
      tags: p.tags,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      isNew: Date.now() - p.firstSeen.getTime() < 30 * 24 * 60 * 60 * 1000,
      provenance: p.provenance,
    })),
    total,
    page,
    pageSize,
    totalPages,
    source: "demo-seed" as const,
  };
}

export async function getProduct(id: string) {
  const { organizationId } = await tenantDb();
  const product = await providers(organizationId).products.getById(id);
  if (!product) return null;

  // Calculated from observed rows (labeled as such by callers).
  const { db } = await tenantDb();
  const [reviewStats, storeAdCount] = await Promise.all([
    db.review.aggregate({
      where: { productId: id },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    db.ad.count({ where: { storeId: product.storeId } }),
  ]);

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    price: Number(product.price),
    currency: product.currency,
    url: product.url,
    imageUrl: product.imageUrl,
    tags: product.tags,
    firstSeen: product.firstSeen,
    lastSeen: product.lastSeen,
    isNew: Date.now() - product.firstSeen.getTime() < 30 * 24 * 60 * 60 * 1000,
    provenance: product.provenance,
    store: { id: product.store.id, name: product.store.name, domain: product.store.domain },
    reviewCount: reviewStats._count._all,
    avgRating: reviewStats._avg.rating,
    storeAdCount,
  };
}

export async function listStores(rawFilters: unknown) {
  const { organizationId } = await tenantDb();
  const filters = parseFilters(storeFilterSchema, rawFilters);
  const { items, total, page, pageSize, totalPages } =
    await providers(organizationId).stores.list(filters);
  return {
    items: items.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      category: s.category,
      country: s.country,
      platform: s.platform,
      description: s.description,
      productCount: s._count.products,
      provenance: s.provenance,
    })),
    total,
    page,
    pageSize,
    totalPages,
    source: "demo-seed" as const,
  };
}

export async function getStore(id: string) {
  const { organizationId, db } = await tenantDb();
  const store = await providers(organizationId).stores.getById(id);
  if (!store) return null;

  const [adCount, landingPageCount, reviewCount, ads] = await Promise.all([
    db.ad.count({ where: { storeId: id } }),
    db.landingPage.count({ where: { storeId: id } }),
    db.review.count({ where: { storeId: id } }),
    db.ad.findMany({
      where: { storeId: id },
      orderBy: { firstSeen: "desc" },
      take: 5,
      include: { advertiser: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    id: store.id,
    name: store.name,
    domain: store.domain,
    category: store.category,
    country: store.country,
    platform: store.platform,
    description: store.description,
    provenance: store.provenance,
    productCount: store._count.products,
    adCount,
    landingPageCount,
    reviewCount,
    ads: ads.map((a) => ({
      id: a.id,
      title: a.title,
      platform: a.platform,
      format: a.format,
      status: a.status,
      durationDays: a.durationDays,
      advertiserId: a.advertiserId,
      advertiserName: a.advertiser.name,
      provenance: a.provenance,
    })),
    products: store.products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      currency: p.currency,
      tags: p.tags,
      firstSeen: p.firstSeen,
      provenance: p.provenance,
    })),
  };
}

export async function getFilterOptions() {
  const { organizationId, db } = await tenantDb();
  const { products, stores } = providers(organizationId);
  const [productCategories, storeCategories, countries, platforms, storeList] = await Promise.all([
    products.listCategories(),
    stores.listCategories(),
    stores.listCountries(),
    stores.listPlatforms(),
    db.store.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { productCategories, storeCategories, countries, platforms, storeList };
}

export type SearchResultItem = {
  id: string;
  type: "product" | "store" | "advertiser" | "competitor";
  name: string;
  subtitle: string;
  url: string | null;
  provenance: Provenance | "user";
};

export async function globalSearch(
  rawQuery: unknown,
): Promise<{ q: string; results: SearchResultItem[] }> {
  const parsed = searchSchema.safeParse(
    typeof rawQuery === "object" && rawQuery !== null ? rawQuery : { q: rawQuery },
  );
  // Empty/invalid query returns empty groups (never an error, never fabricated).
  if (!parsed.success) return { q: "", results: [] };
  const q = parsed.data.q;

  const { organizationId, db } = await tenantDb();
  const { products, stores } = providers(organizationId);
  const [productHits, storeHits, advertisers, competitors] = await Promise.all([
    products.list({ q, page: 1, pageSize: 5, sort: "newest" }),
    stores.list({ q, page: 1, pageSize: 5, sort: "name" }),
    db.advertiser.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { platform: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { name: "asc" },
      include: { store: { select: { id: true, name: true } } },
    }),
    db.competitor.findMany({
      take: 5,
      include: { store: { select: { id: true, name: true } } },
      where: {
        OR: [
          { alias: { contains: q, mode: "insensitive" } },
          { store: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      orderBy: { addedAt: "desc" },
    }),
  ]);

  const results: SearchResultItem[] = [
    ...productHits.items.map((p): SearchResultItem => ({
      id: p.id,
      type: "product",
      name: p.name,
      subtitle: `${p.store.name} · ${p.category}`,
      url: `/products/${p.id}`,
      provenance: p.provenance,
    })),
    ...storeHits.items.map((s): SearchResultItem => ({
      id: s.id,
      type: "store",
      name: s.name,
      subtitle: `${s.domain} · ${s.category}`,
      url: `/stores/${s.id}`,
      provenance: s.provenance,
    })),
    ...advertisers.map((a): SearchResultItem => ({
      id: a.id,
      type: "advertiser",
      name: a.name,
      subtitle: `${a.platform}${a.store ? ` · ${a.store.name}` : ""}`,
      url: `/advertisers/${a.id}`,
      provenance: "demo",
    })),
    ...competitors.map((c): SearchResultItem => ({
      id: c.id,
      type: "competitor",
      name: c.alias ?? c.store.name,
      subtitle: `Tracked competitor · ${c.store.name}`,
      url: `/stores/${c.storeId}`,
      provenance: "user",
    })),
  ];
  return { q, results };
}

const TREND_WEEKS = 16;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getTrends() {
  const { organizationId } = await tenantDb();
  return getTrendsForOrg(organizationId);
}

export async function getTrendsForOrg(organizationId: string) {
  const db = createTenantClient(organizationId);
  const now = Date.now();
  const windowStart = now - TREND_WEEKS * WEEK_MS;

  const [products, ads] = await Promise.all([
    db.product.findMany({
      where: { firstSeen: { gte: new Date(windowStart) } },
      select: { firstSeen: true, category: true },
    }),
    db.ad.findMany({
      where: { firstSeen: { gte: new Date(windowStart) } },
      select: { firstSeen: true },
    }),
  ]);

  const bucketIndex = (d: Date) =>
    Math.min(TREND_WEEKS - 1, Math.floor((now - d.getTime()) / WEEK_MS));
  const productBuckets = Array.from({ length: TREND_WEEKS }, () => 0);
  const adBuckets = Array.from({ length: TREND_WEEKS }, () => 0);
  // Buckets run oldest → newest for charting.
  for (const p of products) {
    const i = TREND_WEEKS - 1 - bucketIndex(p.firstSeen);
    productBuckets[i] = (productBuckets[i] ?? 0) + 1;
  }
  for (const a of ads) {
    const i = TREND_WEEKS - 1 - bucketIndex(a.firstSeen);
    adBuckets[i] = (adBuckets[i] ?? 0) + 1;
  }

  const labels = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const weekEnd = new Date(now - (TREND_WEEKS - 1 - i) * WEEK_MS);
    return weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const byCategory = new Map<string, { total: number; recent: number }>();
  const recentCutoff = now - 30 * 24 * 60 * 60 * 1000;
  for (const p of products) {
    const entry = byCategory.get(p.category) ?? { total: 0, recent: 0 };
    entry.total += 1;
    if (p.firstSeen.getTime() >= recentCutoff) entry.recent += 1;
    byCategory.set(p.category, entry);
  }
  const categories = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);

  const totalProducts = products.length;
  const totalAds = ads.length;
  const topCategory = categories[0]?.category ?? "—";
  const summary = [
    `${totalProducts} products and ${totalAds} ads were first seen in the last ${TREND_WEEKS} weeks (demo data).`,
    topCategory === "—"
      ? "No category activity in this window."
      : `Most new-product activity is in ${topCategory}.`,
    "Buckets count first-seen dates only — they show when items entered the dataset, not verified market performance.",
  ];

  return {
    weeks: TREND_WEEKS,
    labels,
    productBuckets,
    adBuckets,
    categories,
    summary,
    generatedAt: new Date(),
    // Calculated from demo rows: computed here, sourced from the demo seed.
    provenance: "calculated" as const,
    sourceProvenance: "demo" as const,
  };
}
