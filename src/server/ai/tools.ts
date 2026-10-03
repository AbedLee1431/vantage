import { z } from "zod";
import type { ToolDefinition } from "@/lib/ai";
import { computeInsights } from "@/lib/reviews";
import { createTenantClient } from "@/server/db/tenant";
import { DemoProductProvider, DemoStoreProvider } from "@/server/providers/demo";
import { getTrendsForOrg } from "@/modules/discovery/queries";

/**
 * Analyst tool layer (FR-AI-02). The ONLY data source the AI may read.
 * Every tool takes an explicit organizationId (passed by the authenticated
 * handler — never from the model) and queries tenant-scoped data only.
 * Tools return evidence, never interpretation.
 */

export type ToolContext = { organizationId: string };
export type ToolHandler = (ctx: ToolContext, args: unknown) => Promise<unknown>;
export type ToolEntry = { definition: ToolDefinition; schema: z.ZodType; run: ToolHandler };

const limit = (def: number, max: number) =>
  z.coerce.number().int().min(1).max(max).optional().catch(undefined);

const qSchema = z.string().trim().max(100).optional().catch(undefined);

function providers(organizationId: string) {
  return {
    products: new DemoProductProvider(organizationId),
    stores: new DemoStoreProvider(organizationId),
    db: createTenantClient(organizationId),
  };
}

const searchProducts: ToolEntry = {
  definition: {
    name: "searchProducts",
    description: "Search products in the workspace by keyword and category.",
    parameters: {
      type: "object",
      properties: {
        q: { type: "string", description: "Keyword matching name, description, or tag" },
        category: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  schema: z.object({ q: qSchema, category: qSchema, limit: limit(10, 20) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { q?: string; category?: string; limit?: number };
    const { items, total } = await providers(ctx.organizationId).products.list({
      q: a.q,
      category: a.category,
      sort: "newest",
      page: 1,
      pageSize: a.limit ?? 10,
    });
    return {
      total,
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        currency: p.currency,
        store: p.store.name,
      })),
    };
  },
};

const getProduct: ToolEntry = {
  definition: {
    name: "getProduct",
    description: "Full details for one product by id.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  schema: z.object({ id: z.string().min(1).max(50) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { id: string };
    const p = await providers(ctx.organizationId).products.getById(a.id);
    if (!p) return { found: false };
    return {
      found: true,
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: Number(p.price),
      currency: p.currency,
      url: p.url,
      tags: p.tags,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      store: p.store.name,
    };
  },
};

const searchStores: ToolEntry = {
  definition: {
    name: "searchStores",
    description: "Search stores in the workspace by keyword.",
    parameters: {
      type: "object",
      properties: {
        q: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  schema: z.object({ q: qSchema, limit: limit(10, 20) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { q?: string; limit?: number };
    const { items, total } = await providers(ctx.organizationId).stores.list({
      q: a.q,
      sort: "name",
      page: 1,
      pageSize: a.limit ?? 10,
    });
    return {
      total,
      items: items.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        category: s.category,
        country: s.country,
        platform: s.platform,
        productCount: s._count.products,
      })),
    };
  },
};

const getStore: ToolEntry = {
  definition: {
    name: "getStore",
    description: "Full profile for one store by id, including its products and counts.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  schema: z.object({ id: z.string().min(1).max(50) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { id: string };
    const s = await providers(ctx.organizationId).stores.getById(a.id);
    if (!s) return { found: false };
    const { db } = providers(ctx.organizationId);
    const [adCount, reviewCount] = await Promise.all([
      db.ad.count({ where: { storeId: a.id } }),
      db.review.count({ where: { storeId: a.id } }),
    ]);
    return {
      found: true,
      id: s.id,
      name: s.name,
      domain: s.domain,
      category: s.category,
      country: s.country,
      platform: s.platform,
      description: s.description,
      productCount: s._count.products,
      adCount,
      reviewCount,
      products: s.products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) })),
    };
  },
};

const searchAds: ToolEntry = {
  definition: {
    name: "searchAds",
    description: "Search ads by keyword and platform.",
    parameters: {
      type: "object",
      properties: {
        q: { type: "string" },
        platform: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  schema: z.object({ q: qSchema, platform: qSchema, limit: limit(10, 20) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { q?: string; platform?: string; limit?: number };
    const { db } = providers(ctx.organizationId);
    const where = {
      ...(a.q
        ? {
            OR: [
              { title: { contains: a.q, mode: "insensitive" as const } },
              { primaryText: { contains: a.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(a.platform ? { platform: a.platform } : {}),
    };
    const [total, items] = await Promise.all([
      db.ad.count({ where }),
      db.ad.findMany({
        where,
        orderBy: { firstSeen: "desc" },
        take: a.limit ?? 10,
        include: { advertiser: { select: { name: true } }, store: { select: { name: true } } },
      }),
    ]);
    return {
      total,
      items: items.map((x) => ({
        id: x.id,
        title: x.title,
        platform: x.platform,
        format: x.format,
        status: x.status,
        durationDays: x.durationDays,
        advertiser: x.advertiser.name,
        store: x.store?.name ?? null,
      })),
    };
  },
};

const getAd: ToolEntry = {
  definition: {
    name: "getAd",
    description: "Full creative details for one ad by id.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  schema: z.object({ id: z.string().min(1).max(50) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { id: string };
    const { db } = providers(ctx.organizationId);
    const ad = await db.ad.findUnique({
      where: { id: a.id },
      include: { advertiser: { select: { name: true } }, store: { select: { name: true } } },
    });
    if (!ad) return { found: false };
    return {
      found: true,
      id: ad.id,
      title: ad.title,
      primaryText: ad.primaryText,
      headline: ad.headline,
      cta: ad.cta,
      platform: ad.platform,
      format: ad.format,
      status: ad.status,
      durationDays: ad.durationDays,
      firstSeen: ad.firstSeen,
      lastSeen: ad.lastSeen,
      destinationUrl: ad.destinationUrl,
      advertiser: ad.advertiser.name,
      store: ad.store?.name ?? null,
    };
  },
};

const getReviews: ToolEntry = {
  definition: {
    name: "getReviews",
    description: "Customer reviews, optionally for one product or store.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        storeId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  schema: z.object({
    productId: z.string().min(1).max(50).optional().catch(undefined),
    storeId: z.string().min(1).max(50).optional().catch(undefined),
    limit: limit(20, 50),
  }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { productId?: string; storeId?: string; limit?: number };
    const { db } = providers(ctx.organizationId);
    const where = {
      ...(a.productId ? { productId: a.productId } : {}),
      ...(a.storeId ? { storeId: a.storeId } : {}),
    };
    const [total, items] = await Promise.all([
      db.review.count({ where }),
      db.review.findMany({
        where,
        orderBy: { date: "desc" },
        take: a.limit ?? 20,
        include: {
          product: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      total,
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        date: r.date,
        source: r.source,
        product: r.product?.name ?? null,
        store: r.store?.name ?? null,
      })),
    };
  },
};

const getTrends: ToolEntry = {
  definition: {
    name: "getTrends",
    description: "Computed trend summary (new products/ads per week, category momentum).",
    parameters: { type: "object", properties: {} },
  },
  schema: z.object({}),
  async run(ctx) {
    // Explicit-org reuse of the discovery computation (no session needed).
    const t = await getTrendsForOrg(ctx.organizationId);
    return { summary: t.summary, categories: t.categories };
  },
};

const getReviewInsights: ToolEntry = {
  definition: {
    name: "getReviewInsights",
    description:
      "Computed review themes, sentiment, and pain points (keyword counts + rating math, labeled Calculated).",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        storeId: { type: "string" },
      },
    },
  },
  schema: z.object({
    productId: z.string().min(1).max(50).optional().catch(undefined),
    storeId: z.string().min(1).max(50).optional().catch(undefined),
  }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { productId?: string; storeId?: string };
    const { db } = providers(ctx.organizationId);
    const reviews = await db.review.findMany({
      where: {
        ...(a.productId ? { productId: a.productId } : {}),
        ...(a.storeId ? { storeId: a.storeId } : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
    });
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
    return {
      total: insights.sentiment.count,
      avgRating: insights.sentiment.avg,
      distribution: insights.sentiment.distribution,
      negativeThemes: insights.negativeThemes.map((t) => ({
        theme: t.theme,
        count: t.count,
        examples: t.examples.map((e) => ({
          id: e.id,
          rating: e.rating,
          quote: e.quote.slice(0, 160),
        })),
      })),
      positiveThemes: insights.positiveThemes.map((t) => ({ theme: t.theme, count: t.count })),
      featureRequests: insights.featureRequests.map((t) => ({ theme: t.theme, count: t.count })),
    };
  },
};

const listOpportunities: ToolEntry = {
  definition: {
    name: "listOpportunities",
    description: "Open market-gap opportunities with evidence and confidence.",
    parameters: { type: "object", properties: {} },
  },
  schema: z.object({}),
  async run(ctx) {
    const { db } = providers(ctx.organizationId);
    const rows = await db.opportunity.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description.slice(0, 500),
      confidence: o.confidence,
      createdAt: o.createdAt,
    }));
  },
};

const listCompetitors: ToolEntry = {
  definition: {
    name: "listCompetitors",
    description: "Stores this workspace tracks as competitors.",
    parameters: { type: "object", properties: {} },
  },
  schema: z.object({}),
  async run(ctx) {
    const { db } = providers(ctx.organizationId);
    const rows = await db.competitor.findMany({
      orderBy: { addedAt: "desc" },
      include: { store: { select: { id: true, name: true, domain: true, category: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      alias: c.alias,
      store: c.store.name,
      storeId: c.store.id,
    }));
  },
};

const getRecentChanges: ToolEntry = {
  definition: {
    name: "getRecentChanges",
    description: "Latest tracked changes (new products/ads, price moves, reviews).",
    parameters: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
    },
  },
  schema: z.object({ limit: limit(10, 20) }),
  async run(ctx, args) {
    const a = this.schema.parse(args) as { limit?: number };
    const { db } = providers(ctx.organizationId);
    const items = await db.changeEvent.findMany({
      orderBy: { detectedAt: "desc" },
      take: a.limit ?? 10,
    });
    return items.map((c) => ({ type: c.type, summary: c.summary, detectedAt: c.detectedAt }));
  },
};

export const AI_TOOLS: Record<string, ToolEntry> = {
  searchProducts,
  getProduct,
  searchStores,
  getStore,
  searchAds,
  getAd,
  getReviews,
  getReviewInsights,
  getTrends,
  listCompetitors,
  listOpportunities,
  getRecentChanges,
};

export function toolDefinitions(): ToolDefinition[] {
  return Object.values(AI_TOOLS).map((t) => t.definition);
}

/** Dispatch a model-requested tool call (validates args, enforces tenant scope). */
export async function callTool(
  organizationId: string,
  name: string,
  args: unknown,
): Promise<unknown> {
  const tool = AI_TOOLS[name];
  if (!tool) {
    throw new Error(`Unknown tool "${name}". Available: ${Object.keys(AI_TOOLS).join(", ")}.`);
  }
  try {
    return await tool.run({ organizationId }, args);
  } catch (error) {
    // Log for operators; the model receives a structured error it can act on.
    console.error(`[ai-tools] ${name} failed:`, error instanceof Error ? error.message : error);
    throw error;
  }
}
