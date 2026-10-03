import { computeInsights } from "@/lib/reviews";
import type { EvidenceRef } from "@/lib/ai";
import { createTenantClient } from "../db/tenant";
import {
  DemoAdvertisingProvider,
  DemoProductProvider,
  DemoStoreProvider,
  DemoReviewProvider,
} from "../providers/demo";
import { getTrendsForOrg } from "@/modules/discovery/queries";
import { formatCurrency } from "@/lib/format";

/**
 * Report section assembly (Phase 7). Deterministic builders gather tenant-scoped
 * facts into snapshot sections; the job handler adds the AI summary on top.
 * Empty sections are omitted (never rendered as meaningless placeholders).
 * All money renders via formatCurrency (no float artifacts in snapshots).
 */

export type ReportSection =
  | {
      kind: "stats";
      key: string;
      title: string;
      stats: { label: string; value: string }[];
      provenance: "demo" | "calculated";
    }
  | {
      kind: "table";
      key: string;
      title: string;
      columns: string[];
      rows: string[][];
      provenance: "demo" | "calculated";
      note?: string;
    }
  | { kind: "list"; key: string; title: string; items: string[]; provenance: "demo" | "calculated" }
  | {
      kind: "text";
      key: string;
      title: string;
      text: string;
      provenance: "demo" | "calculated" | "ai";
    };

export type BuiltSections = {
  title: string;
  sections: ReportSection[];
  evidence: EvidenceRef[];
  factSheet: Record<string, unknown>;
};

type Ctx = {
  db: ReturnType<typeof createTenantClient>;
  products: DemoProductProvider;
  stores: DemoStoreProvider;
  ads: DemoAdvertisingProvider;
  reviews: DemoReviewProvider;
};

function ctxFor(organizationId: string): Ctx {
  return {
    db: createTenantClient(organizationId),
    products: new DemoProductProvider(organizationId),
    stores: new DemoStoreProvider(organizationId),
    ads: new DemoAdvertisingProvider(organizationId),
    reviews: new DemoReviewProvider(organizationId),
  };
}

function ref(type: EvidenceRef["type"], id: string, label: string): EvidenceRef {
  return { type, id, label };
}

async function productRows(ctx: Ctx, storeId?: string) {
  const { items } = await ctx.products.list({
    ...(storeId ? { storeId } : {}),
    sort: "newest",
    page: 1,
    pageSize: 20,
  });
  return items;
}

export async function buildCompetitorSections(
  organizationId: string,
  storeId: string,
): Promise<BuiltSections | null> {
  const ctx = ctxFor(organizationId);
  const store = await ctx.stores.getById(storeId);
  if (!store) return null;

  const [products, ads, reviews, changes] = await Promise.all([
    productRows(ctx, storeId),
    ctx.db.ad.findMany({ where: { storeId }, orderBy: { firstSeen: "desc" }, take: 20 }),
    ctx.db.review.findMany({
      where: { OR: [{ storeId }, { product: { storeId } }] },
      orderBy: { date: "desc" },
      take: 50,
    }),
    ctx.db.changeEvent.findMany({ orderBy: { detectedAt: "desc" }, take: 50 }),
  ]);
  const storeChanges = changes.filter(
    (c) =>
      c.refId === storeId ||
      products.some((p) => p.id === c.refId) ||
      ads.some((a) => a.id === c.refId),
  );
  const openOpps = await ctx.db.opportunity.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const sections: ReportSection[] = [];
  const evidence: EvidenceRef[] = [ref("store", store.id, store.name)];

  sections.push({
    kind: "text",
    key: "overview",
    title: "Store Overview",
    text: `${store.name} (${store.domain}) — ${store.category}, ${store.country}, on ${store.platform}. ${store.description ?? "No description recorded."}`,
    provenance: "demo",
  });

  if (products.length > 0) {
    const prices = products.map((p) => Number(p.price));
    sections.push({
      kind: "table",
      key: "products",
      title: `Products (${products.length})`,
      columns: ["Product", "Category", "Price"],
      rows: products.map((p) => [p.name, p.category, formatCurrency(Number(p.price), p.currency)]),
      provenance: "demo",
      note: `Price span ${formatCurrency(Math.min(...prices), "USD")}–${formatCurrency(Math.max(...prices), "USD")} (calculated).`,
    });
    for (const p of products.slice(0, 10)) evidence.push(ref("product", p.id, p.name));
  }

  if (ads.length > 0) {
    const byPlatform = new Map<string, number>();
    for (const a of ads) byPlatform.set(a.platform, (byPlatform.get(a.platform) ?? 0) + 1);
    sections.push({
      kind: "table",
      key: "advertising",
      title: `Advertising (${ads.length})`,
      columns: ["Ad", "Platform", "Format", "Status", "Run"],
      rows: ads.map((a) => [a.title, a.platform, a.format, a.status, `${a.durationDays}d`]),
      provenance: "demo",
      note: `By platform: ${[...byPlatform.entries()].map(([k, v]) => `${k} ${v}`).join(", ")} (calculated). No performance metrics exist.`,
    });
    for (const a of ads.slice(0, 10)) evidence.push(ref("ad", a.id, a.title));
  }

  if (reviews.length > 0) {
    const insights = computeInsights(
      reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        date: r.date,
        productName: null,
        storeName: null,
      })),
    );
    sections.push({
      kind: "stats",
      key: "customer",
      title: "Customer Intelligence",
      stats: [
        { label: "Reviews", value: String(insights.sentiment.count) },
        {
          label: "Average rating",
          value: insights.sentiment.avg !== null ? `${insights.sentiment.avg.toFixed(1)}/5` : "—",
        },
        {
          label: "Top pain theme",
          value: insights.negativeThemes[0]
            ? `${insights.negativeThemes[0].theme} ×${insights.negativeThemes[0].count}`
            : "None detected",
        },
      ],
      provenance: "calculated",
    });
    for (const r of reviews.slice(0, 5)) evidence.push(ref("review", r.id, r.title ?? "review"));
  }

  if (storeChanges.length > 0) {
    sections.push({
      kind: "list",
      key: "changes",
      title: `Observed Changes (${storeChanges.length})`,
      items: storeChanges.slice(0, 10).map((c) => c.summary),
      provenance: "demo",
    });
  }

  if (openOpps.length > 0) {
    sections.push({
      kind: "list",
      key: "opportunities",
      title: "Open Opportunities (workspace-wide)",
      items: openOpps.map((o) => `${o.title} [${o.confidence} confidence]`),
      provenance: "demo",
    });
    for (const o of openOpps) evidence.push({ type: "product", id: o.id, label: o.title });
  }

  return {
    title: `Competitor Report — ${store.name}`,
    sections,
    evidence,
    factSheet: {
      store: store.name,
      products: products.length,
      ads: ads.length,
      reviews: reviews.length,
      changes: storeChanges.length,
      opportunities: openOpps.length,
    },
  };
}

export async function buildProductSections(
  organizationId: string,
  productId: string,
): Promise<BuiltSections | null> {
  const ctx = ctxFor(organizationId);
  const product = await ctx.products.getById(productId);
  if (!product) return null;

  const [reviews, storeAds] = await Promise.all([
    ctx.db.review.findMany({ where: { productId }, orderBy: { date: "desc" }, take: 50 }),
    ctx.db.ad.findMany({
      where: { storeId: product.storeId },
      orderBy: { firstSeen: "desc" },
      take: 10,
      include: { advertiser: { select: { name: true } } },
    }),
  ]);
  const insights = computeInsights(
    reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: r.date,
      productName: product.name,
      storeName: null,
    })),
  );

  const sections: ReportSection[] = [
    {
      kind: "text",
      key: "overview",
      title: "Product Overview",
      text: `${product.name} (${product.category}) at ${formatCurrency(Number(product.price), product.currency)} from ${product.store.name}. First seen ${product.firstSeen.toISOString().slice(0, 10)}. ${product.description ?? ""}`.trim(),
      provenance: "demo",
    },
  ];
  const evidence: EvidenceRef[] = [ref("product", product.id, product.name)];

  if (reviews.length > 0) {
    sections.push({
      kind: "stats",
      key: "customer",
      title: "Customer Intelligence",
      stats: [
        { label: "Reviews", value: String(insights.sentiment.count) },
        {
          label: "Average rating",
          value: insights.sentiment.avg !== null ? `${insights.sentiment.avg.toFixed(1)}/5` : "—",
        },
        {
          label: "Negative share",
          value: insights.sentiment.count
            ? `${Math.round((insights.sentiment.negative / insights.sentiment.count) * 100)}%`
            : "—",
        },
      ],
      provenance: "calculated",
    });
    for (const r of reviews.slice(0, 5)) evidence.push(ref("review", r.id, r.title ?? "review"));
  }

  if (storeAds.length > 0) {
    sections.push({
      kind: "table",
      key: "advertising",
      title: `Store Advertising (${storeAds.length} shown)`,
      columns: ["Ad", "Platform", "Format", "Status"],
      rows: storeAds.map((a) => [a.title, a.platform, a.format, a.status]),
      provenance: "demo",
      note: "Store-level activity (ads are not linked to individual products). No performance metrics exist.",
    });
    for (const a of storeAds.slice(0, 5)) evidence.push(ref("ad", a.id, a.title));
  }

  return {
    title: `Product Intelligence — ${product.name}`,
    sections,
    evidence,
    factSheet: {
      product: product.name,
      price: Number(product.price),
      reviews: reviews.length,
      storeAds: storeAds.length,
    },
  };
}

export async function buildAdvertisingSections(
  organizationId: string,
  filter: { advertiserId?: string; platform?: string },
): Promise<BuiltSections> {
  const ctx = ctxFor(organizationId);
  const { items } = await ctx.ads.listAds({
    advertiserId: filter.advertiserId,
    platform: filter.platform,
    sort: "newest",
    page: 1,
    pageSize: 50,
  });

  const sections: ReportSection[] = [];
  const evidence: EvidenceRef[] = [];
  if (items.length > 0) {
    const byPlatform = new Map<string, number>();
    const byFormat = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const a of items) {
      byPlatform.set(a.platform, (byPlatform.get(a.platform) ?? 0) + 1);
      byFormat.set(a.format, (byFormat.get(a.format) ?? 0) + 1);
      byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
    }
    sections.push({
      kind: "stats",
      key: "inventory",
      title: "Ad Inventory",
      stats: [
        { label: "Total ads", value: String(items.length) },
        { label: "Active", value: String(byStatus.get("active") ?? 0) },
        { label: "Platforms", value: String(byPlatform.size) },
        { label: "Formats", value: String(byFormat.size) },
      ],
      provenance: "calculated",
    });
    sections.push({
      kind: "table",
      key: "ads",
      title: "Ads",
      columns: ["Ad", "Advertiser", "Platform", "Format", "Status", "Run"],
      rows: items.map((a) => [
        a.title,
        a.advertiser.name,
        a.platform,
        a.format,
        a.status,
        `${a.durationDays}d`,
      ]),
      provenance: "demo",
      note: "Observed metadata only. No spend, impression, or conversion data exists.",
    });
    for (const a of items.slice(0, 15)) evidence.push(ref("ad", a.id, a.title));
  }
  return {
    title: "Advertising Report",
    sections,
    evidence,
    factSheet: { ads: items.length },
  };
}

export async function buildCustomerSections(
  organizationId: string,
  scope: { productId?: string; storeId?: string },
): Promise<BuiltSections> {
  const ctx = ctxFor(organizationId);
  const { items } = await ctx.reviews.list({
    productId: scope.productId,
    storeId: scope.storeId,
    sort: "newest",
    page: 1,
    pageSize: 100,
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

  const sections: ReportSection[] = [];
  const evidence: EvidenceRef[] = [];
  sections.push({
    kind: "stats",
    key: "sentiment",
    title: "Sentiment Overview",
    stats: [
      { label: "Reviews", value: String(insights.sentiment.count) },
      {
        label: "Average rating",
        value: insights.sentiment.avg !== null ? `${insights.sentiment.avg.toFixed(1)}/5` : "—",
      },
      { label: "Positive (4–5★)", value: String(insights.sentiment.positive) },
      { label: "Negative (≤3★)", value: String(insights.sentiment.negative) },
    ],
    provenance: "calculated",
  });
  const themeList = (label: string, buckets: { theme: string; count: number }[]) =>
    buckets.length > 0
      ? {
          kind: "list" as const,
          key: label.toLowerCase().replace(/[^a-z]+/g, "-"),
          title: label,
          items: buckets.map((t) => `${t.theme} ×${t.count}`),
          provenance: "calculated" as const,
        }
      : null;
  for (const section of [
    themeList("Positive Themes", insights.positiveThemes),
    themeList("Pain Points", insights.negativeThemes),
    themeList("Feature Requests", insights.featureRequests),
  ]) {
    if (section) sections.push(section);
  }
  if (items.length > 0) {
    sections.push({
      kind: "table",
      key: "reviews",
      title: `Reviews (${items.length} shown)`,
      columns: ["Rating", "Title", "Product", "Date"],
      rows: items
        .slice(0, 25)
        .map((r) => [
          `${r.rating}★`,
          r.title ?? "(no title)",
          r.product?.name ?? r.store?.name ?? "—",
          r.date.toISOString().slice(0, 10),
        ]),
      provenance: "demo",
    });
    for (const r of items.slice(0, 10)) evidence.push(ref("review", r.id, r.title ?? "review"));
  }
  return {
    title: "Customer Intelligence Report",
    sections,
    evidence,
    factSheet: { reviews: items.length, avg: insights.sentiment.avg },
  };
}

export async function buildTrendsSections(organizationId: string): Promise<BuiltSections> {
  const trends = await getTrendsForOrg(organizationId);
  const sections: ReportSection[] = [
    {
      kind: "stats",
      key: "activity",
      title: "Activity (16 weeks)",
      stats: [
        { label: "New products", value: String(trends.productBuckets.reduce((a, b) => a + b, 0)) },
        { label: "New ads", value: String(trends.adBuckets.reduce((a, b) => a + b, 0)) },
        { label: "Active categories", value: String(trends.categories.length) },
      ],
      provenance: "calculated",
    },
  ];
  if (trends.categories.length > 0) {
    sections.push({
      kind: "table",
      key: "categories",
      title: "Category Momentum",
      columns: ["Category", "Total", "Recent (30d)"],
      rows: trends.categories.map((c) => [c.category, String(c.total), String(c.recent)]),
      provenance: "calculated",
      note: "Counts of first-seen dates, not verified market performance.",
    });
  }
  return {
    title: "Market Trends Report",
    sections,
    evidence: [],
    factSheet: { weeks: trends.weeks },
  };
}

export async function buildMonitoringSections(organizationId: string): Promise<BuiltSections> {
  const db = createTenantClient(organizationId);
  const [changes, alerts, lists] = await Promise.all([
    db.changeEvent.findMany({ orderBy: { detectedAt: "desc" }, take: 20 }),
    db.alert.findMany({
      where: { acknowledgedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { changeEvent: { select: { summary: true } } },
    }),
    db.watchlist.findMany({ include: { _count: { select: { items: true } } } }),
  ]);
  const sections: ReportSection[] = [
    {
      kind: "stats",
      key: "watchlists",
      title: "Watchlist Coverage",
      stats: [
        { label: "Watchlists", value: String(lists.length) },
        {
          label: "Tracked items",
          value: String(lists.reduce((a, w) => a + w._count.items, 0)),
        },
        { label: "Unacknowledged alerts", value: String(alerts.length) },
      ],
      provenance: "calculated",
    },
  ];
  const evidence: EvidenceRef[] = [];
  if (changes.length > 0) {
    sections.push({
      kind: "list",
      key: "changes",
      title: `Recent Changes (${changes.length} shown)`,
      items: changes.map((c) => c.summary),
      provenance: "demo",
    });
  }
  if (alerts.length > 0) {
    sections.push({
      kind: "list",
      key: "alerts",
      title: "Open Alerts",
      items: alerts.map((a) => `[${a.severity}] ${a.changeEvent.summary}`),
      provenance: "demo",
    });
  }
  return {
    title: "Monitoring Report",
    sections,
    evidence,
    factSheet: { changes: changes.length, alerts: alerts.length, lists: lists.length },
  };
}

export async function buildCombinedSections(organizationId: string): Promise<BuiltSections> {
  const parts = await Promise.all([
    buildCustomerSections(organizationId, {}),
    buildTrendsSections(organizationId),
    buildMonitoringSections(organizationId),
  ]);
  const [customer, trends, monitoring] = parts;
  const { items: products } = await new DemoProductProvider(organizationId).list({
    sort: "newest",
    page: 1,
    pageSize: 10,
  });
  const { items: ads } = await new DemoAdvertisingProvider(organizationId).listAds({
    sort: "newest",
    page: 1,
    pageSize: 10,
  });

  const sections: ReportSection[] = [];
  const evidence: EvidenceRef[] = [];
  if (products.length > 0) {
    sections.push({
      kind: "table",
      key: "products",
      title: `Products (${products.length} shown)`,
      columns: ["Product", "Category", "Price", "Store"],
      rows: products.map((p) => [
        p.name,
        p.category,
        formatCurrency(Number(p.price), p.currency),
        p.store.name,
      ]),
      provenance: "demo",
    });
    for (const p of products.slice(0, 10)) evidence.push(ref("product", p.id, p.name));
  }
  if (ads.length > 0) {
    sections.push({
      kind: "table",
      key: "ads",
      title: `Ads (${ads.length} shown)`,
      columns: ["Ad", "Platform", "Format", "Status"],
      rows: ads.map((a) => [a.title, a.platform, a.format, a.status]),
      provenance: "demo",
      note: "Observed metadata only; no performance data exists.",
    });
    for (const a of ads.slice(0, 10)) evidence.push(ref("ad", a.id, a.title));
  }
  for (const part of [customer, trends, monitoring]) {
    sections.push(...part.sections);
    evidence.push(...part.evidence);
  }
  return {
    title: "Combined Intelligence Report",
    sections,
    evidence,
    factSheet: { products: products.length, ads: ads.length },
  };
}
