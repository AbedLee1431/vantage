import { createHash } from "node:crypto";
import type { AdAnalysisResult, CompetitorAnalysisResult, EvidenceRef } from "@/lib/ai";
import { computeInsights } from "@/lib/reviews";
import {
  AD_ANALYSIS_SYSTEM,
  COMPETITOR_ANALYSIS_SYSTEM,
  OPPORTUNITY_SYSTEM,
  PROMPT_VERSION,
  REVIEW_SUMMARY_SYSTEM,
  adAnalysisResultSchema,
  competitorAnalysisResultSchema,
  opportunityListSchema,
} from "../ai/prompts";
import type { AIProvider } from "@/lib/ai";
import { createTenantClient } from "../db/tenant";
import { buildDemoOpportunities, buildDemoReviewSummary } from "../ai/demo-content";

/**
 * Analysis handlers (ad + competitor). Evidence is gathered tenant-scoped,
 * the provider analyzes, output is Zod-validated, citations are verified
 * against real rows (R4), and the result persists with provenance.
 * Demo provider rows store provenance "demo"; live rows store "ai".
 */

type TenantDb = ReturnType<typeof createTenantClient>;

export function promptHash(
  kind: string,
  targetId: string,
  targetUpdatedAt: Date,
  provider: AIProvider,
): string {
  return createHash("sha256")
    .update(
      [
        kind,
        targetId,
        targetUpdatedAt.toISOString(),
        provider.name,
        provider.model,
        PROMPT_VERSION,
      ].join("|"),
    )
    .digest("hex");
}

export async function findCachedAnalysis(
  db: TenantDb,
  kind: "ad" | "competitor" | "review_summary",
  targetRef: string,
  hash: string,
) {
  return db.aiAnalysis.findFirst({
    where: { kind, targetRef, promptHash: hash },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveCitations(
  db: TenantDb,
  ids: string[],
): Promise<{ verified: EvidenceRef[]; dropped: number }> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(
    0,
    20,
  );
  const verified: EvidenceRef[] = [];
  let dropped = 0;
  for (const id of unique) {
    const found = await findEntityById(db, id);
    if (found) verified.push(found);
    else dropped++;
  }
  return { verified, dropped };
}

async function findEntityById(db: TenantDb, id: string): Promise<EvidenceRef | null> {
  const product = await db.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (product) return { type: "product", id, label: product.name };
  const store = await db.store.findUnique({ where: { id }, select: { id: true, name: true } });
  if (store) return { type: "store", id, label: store.name };
  const ad = await db.ad.findUnique({ where: { id }, select: { id: true, title: true } });
  if (ad) return { type: "ad", id, label: ad.title };
  const advertiser = await db.advertiser.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (advertiser) return { type: "advertiser", id, label: advertiser.name };
  const review = await db.review.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (review) return { type: "review", id, label: review.title ?? "review" };
  const competitor = await db.competitor.findUnique({
    where: { id },
    select: { id: true, alias: true, store: { select: { name: true } } },
  });
  if (competitor)
    return { type: "competitor", id, label: competitor.alias ?? competitor.store.name };
  return null;
}

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  // Never leak keys, tokens, or raw prompts — codes + short reasons only.
  return message.replace(/[A-Za-z0-9_\-]{32,}/g, "[redacted]").slice(0, 500);
}

type AdEvidence = {
  ad: {
    id: string;
    title: string;
    primaryText: string | null;
    headline: string | null;
    cta: string | null;
    platform: string;
    format: string;
    status: string;
    durationDays: number;
    firstSeen: Date;
    lastSeen: Date;
    destinationUrl: string | null;
    updatedAt: Date;
  };
  store: { id: string; name: string; domain: string; category: string } | null;
  advertiser: { id: string; name: string; platform: string };
  storeAdCount: number;
};

async function buildAdEvidence(
  db: TenantDb,
  adId: string,
): Promise<{ evidence: AdEvidence; citations: string[] } | null> {
  const ad = await db.ad.findUnique({
    where: { id: adId },
    include: {
      advertiser: { select: { id: true, name: true, platform: true } },
      store: { select: { id: true, name: true, domain: true, category: true } },
    },
  });
  if (!ad) return null;
  const storeAdCount = ad.storeId ? await db.ad.count({ where: { storeId: ad.storeId } }) : 0;
  const citations = [ad.id, ad.advertiser.id, ...(ad.store ? [ad.store.id] : [])];
  return {
    evidence: {
      ad: {
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
        updatedAt: ad.updatedAt,
      },
      store: ad.store,
      advertiser: ad.advertiser,
      storeAdCount,
    },
    citations,
  };
}

export async function handleAdAnalysis(
  organizationId: string,
  adId: string,
  provider: AIProvider,
): Promise<{ analysisId: string; cached: boolean }> {
  const db = createTenantClient(organizationId);
  const built = await buildAdEvidence(db, adId);
  if (!built) throw new Error("Ad not found.");
  const hash = promptHash("ad", adId, built.evidence.ad.updatedAt, provider);

  const cached = await findCachedAnalysis(db, "ad", adId, hash);
  if (cached) return { analysisId: cached.id, cached: true };

  const { json } = await provider.analyze({
    system: AD_ANALYSIS_SYSTEM,
    user: JSON.stringify({
      task: "Analyze this ad into 8 sections + angle.",
      evidence: built.evidence,
    }),
    evidence: { kind: "ad", ...built.evidence },
  });
  const parsed = adAnalysisResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Model output failed validation (${parsed.error.issues.length} issue(s)).`);
  }
  const result: AdAnalysisResult = {
    ...parsed.data,
    sections: parsed.data.sections as AdAnalysisResult["sections"],
  };

  const citedIds = Array.isArray((json as { citations?: unknown }).citations)
    ? (json as { citations: unknown[] }).citations.filter((c): c is string => typeof c === "string")
    : built.citations;
  const { verified, dropped } = await resolveCitations(db, [...built.citations, ...citedIds]);
  if (dropped > 0) {
    result.disclaimers = [
      ...result.disclaimers,
      `${dropped} cited reference(s) could not be verified and were removed.`,
    ];
  }

  const row = await db.aiAnalysis.create({
    data: {
      organizationId,
      kind: "ad",
      targetRef: adId,
      promptHash: hash,
      result: result as unknown as object,
      evidence: verified as unknown as object,
      provider: provider.name,
      model: provider.model,
      provenance: provider.name === "demo" ? "demo" : "ai",
    },
  });
  return { analysisId: row.id, cached: false };
}

export async function handleCompetitorAnalysis(
  organizationId: string,
  storeId: string,
  provider: AIProvider,
): Promise<{ analysisId: string; cached: boolean }> {
  const db = createTenantClient(organizationId);
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Store not found.");
  const hash = promptHash("competitor", storeId, store.updatedAt, provider);

  const cached = await findCachedAnalysis(db, "competitor", storeId, hash);
  if (cached) return { analysisId: cached.id, cached: true };

  const [products, ads, landingPages, reviews, changes, tracked] = await Promise.all([
    db.product.findMany({ where: { storeId }, orderBy: { price: "asc" } }),
    db.ad.findMany({ where: { storeId } }),
    db.landingPage.findMany({ where: { storeId } }),
    db.review.findMany({
      where: { OR: [{ storeId }, { product: { storeId } }] },
      orderBy: { date: "desc" },
      take: 20,
    }),
    db.changeEvent.findMany({ orderBy: { detectedAt: "desc" }, take: 20 }),
    db.competitor.findFirst({ where: { storeId } }),
  ]);

  const byPlatform: Record<string, number> = {};
  const byFormat: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const a of ads) {
    byPlatform[a.platform] = (byPlatform[a.platform] ?? 0) + 1;
    byFormat[a.format] = (byFormat[a.format] ?? 0) + 1;
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  }
  const ratings = reviews.map((r) => r.rating);
  const evidence = {
    store: {
      id: store.id,
      name: store.name,
      domain: store.domain,
      category: store.category,
      country: store.country,
      platform: store.platform,
      description: store.description,
    },
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
    })),
    adSummary: { total: ads.length, active: byStatus.active ?? 0, byPlatform, byFormat },
    landingPages: landingPages.map((l) => ({ id: l.id, url: l.url, title: l.title })),
    reviewSummary: {
      count: reviews.length,
      avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      recent: reviews.slice(0, 5).map((r) => ({ rating: r.rating, title: r.title })),
    },
    changes: changes
      .filter(
        (c) =>
          c.refId === storeId ||
          products.some((p) => p.id === c.refId) ||
          ads.some((a) => a.id === c.refId),
      )
      .slice(0, 10)
      .map((c) => ({ type: c.type, summary: c.summary, detectedAt: c.detectedAt })),
    tracked: tracked !== null,
  };
  const citations = [store.id, ...products.slice(0, 3).map((p) => p.id)];

  const { json } = await provider.analyze({
    system: COMPETITOR_ANALYSIS_SYSTEM,
    user: JSON.stringify({ task: "Analyze this competitor into 11 sections.", evidence }),
    evidence: { kind: "competitor", ...evidence },
  });
  const parsed = competitorAnalysisResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Model output failed validation (${parsed.error.issues.length} issue(s)).`);
  }
  const result: CompetitorAnalysisResult = {
    sections: parsed.data.sections as CompetitorAnalysisResult["sections"],
    disclaimers: parsed.data.disclaimers,
  };

  const citedIds = Array.isArray((json as { citations?: unknown }).citations)
    ? (json as { citations: unknown[] }).citations.filter((c): c is string => typeof c === "string")
    : citations;
  const { verified, dropped } = await resolveCitations(db, [...citations, ...citedIds]);
  if (dropped > 0) {
    result.disclaimers = [
      ...result.disclaimers,
      `${dropped} cited reference(s) could not be verified and were removed.`,
    ];
  }

  const row = await db.aiAnalysis.create({
    data: {
      organizationId,
      kind: "competitor",
      targetRef: storeId,
      promptHash: hash,
      result: result as unknown as object,
      evidence: verified as unknown as object,
      provider: provider.name,
      model: provider.model,
      provenance: provider.name === "demo" ? "demo" : "ai",
    },
  });
  return { analysisId: row.id, cached: false };
}

export type ReviewScope = { productId?: string; storeId?: string };

function scopeKey(scope: ReviewScope): string {
  if (scope.productId) return `product:${scope.productId}`;
  if (scope.storeId) return `store:${scope.storeId}`;
  return "org";
}

export async function handleReviewSummary(
  organizationId: string,
  scope: ReviewScope,
  provider: AIProvider,
): Promise<{ analysisId: string; cached: boolean }> {
  const db = createTenantClient(organizationId);
  const reviews = await db.review.findMany({
    where: {
      ...(scope.productId ? { productId: scope.productId } : {}),
      ...(scope.storeId ? { storeId: scope.storeId } : {}),
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  // Content fingerprint: cache invalidates when reviews change (or appear).
  const fingerprint = reviews.length
    ? createHash("sha256")
        .update(
          reviews
            .map((r) => `${r.id}:${r.updatedAt.toISOString()}`)
            .sort()
            .join("|"),
        )
        .digest("hex")
    : "empty";
  // Content fingerprint: cache invalidates when reviews change (or appear).
  const contentHash = createHash("sha256")
    .update(
      [
        "review_summary",
        scopeKey(scope),
        fingerprint,
        provider.name,
        provider.model,
        PROMPT_VERSION,
      ].join("|"),
    )
    .digest("hex");

  const cached = await findCachedAnalysis(db, "review_summary", scopeKey(scope), contentHash);
  if (cached) return { analysisId: cached.id, cached: true };

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
  const scopeLabel = scope.productId
    ? `product ${scope.productId}`
    : scope.storeId
      ? `store ${scope.storeId}`
      : "workspace";

  let result: { sections: AnalysisSectionLike[]; disclaimers: string[] };
  let citations: string[];
  if (provider.name === "demo") {
    const built = buildDemoReviewSummary({
      scopeLabel,
      total: insights.sentiment.count,
      avg: insights.sentiment.avg,
      distribution: insights.sentiment.distribution,
      painThemes: insights.negativeThemes.map((t) => ({
        theme: t.theme,
        count: t.count,
        quotes: t.examples.map((e) => ({ id: e.id, rating: e.rating, quote: e.quote })),
      })),
      featureRequests: insights.featureRequests.map((t) => ({
        theme: t.theme,
        count: t.count,
        quotes: t.examples.map((e) => ({ id: e.id, rating: e.rating, quote: e.quote })),
      })),
      reviewIds: reviews.map((r) => r.id),
    });
    result = { sections: built.sections, disclaimers: built.disclaimers };
    citations = built.citations;
  } else {
    const { json } = await provider.analyze({
      system: REVIEW_SUMMARY_SYSTEM,
      user: JSON.stringify({
        task: "Summarize recurring pain points from these reviews.",
        scope: scopeLabel,
        insights,
        reviews: reviews.slice(0, 30).map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          body: r.body.slice(0, 500),
        })),
      }),
      evidence: { kind: "review_summary", scope: scopeLabel },
    });
    const parsed = competitorAnalysisResultSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Model output failed validation (${parsed.error.issues.length} issue(s)).`);
    }
    result = { sections: parsed.data.sections, disclaimers: parsed.data.disclaimers };
    citations = Array.isArray((json as { citations?: unknown }).citations)
      ? (json as { citations: unknown[] }).citations.filter(
          (c): c is string => typeof c === "string",
        )
      : reviews.slice(0, 10).map((r) => r.id);
  }

  const { verified, dropped } = await resolveCitations(db, citations);
  const disclaimers =
    dropped > 0
      ? [
          ...result.disclaimers,
          `${dropped} cited reference(s) could not be verified and were removed.`,
        ]
      : result.disclaimers;

  const row = await db.aiAnalysis.create({
    data: {
      organizationId,
      kind: "review_summary",
      targetRef: scopeKey(scope),
      promptHash: contentHash,
      result: { sections: result.sections, disclaimers } as unknown as object,
      evidence: verified as unknown as object,
      provider: provider.name,
      model: provider.model,
      provenance: provider.name === "demo" ? "demo" : "ai",
    },
  });
  return { analysisId: row.id, cached: false };
}

type AnalysisSectionLike = {
  key: string;
  title: string;
  observed: string[];
  calculated: string[];
  interpretation: string;
  assumption?: string;
  needsValidation?: string;
  confidence: "low" | "medium" | "high";
};

export async function handleOpportunityAnalysis(
  organizationId: string,
  provider: AIProvider,
): Promise<{ created: string[]; skipped: number }> {
  const db = createTenantClient(organizationId);
  const [products, stores, reviews] = await Promise.all([
    db.product.findMany({ include: { store: { select: { name: true } } } }),
    db.store.findMany({ select: { id: true, name: true } }),
    db.review.findMany({ orderBy: { date: "desc" }, take: 200 }),
  ]);
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

  type Draft = {
    title: string;
    description: string;
    evidence: string[];
    supportingData: Record<string, string | number | boolean>;
    competitors: string[];
    painPoints: string[];
    differentiation: string;
    confidence: "low" | "medium" | "high";
    citations: string[];
  };
  let drafts: Draft[];
  if (provider.name === "demo") {
    drafts = buildDemoOpportunities({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        storeName: p.store.name,
      })),
      reviewThemes: insights.negativeThemes.map((t) => ({
        theme: t.theme,
        count: t.count,
        quotes: t.examples.map((e) => ({ id: e.id, quote: e.quote })),
      })),
      featureRequests:
        insights.featureRequests.length > 0
          ? [
              {
                count: insights.featureRequests[0]!.count,
                quotes: insights.featureRequests[0]!.examples.map((e) => ({
                  id: e.id,
                  quote: e.quote,
                })),
              },
            ]
          : [],
      stores: stores.map((s) => ({ id: s.id, name: s.name })),
    });
  } else {
    const { json } = await provider.analyze({
      system: OPPORTUNITY_SYSTEM,
      user: JSON.stringify({
        task: "Identify market gaps worth investigating.",
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: Number(p.price),
          store: p.store.name,
        })),
        reviewInsights: insights,
        stores: stores.map((s) => ({ id: s.id, name: s.name })),
      }),
      evidence: { kind: "opportunity" },
    });
    const parsed = opportunityListSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Model output failed validation (${parsed.error.issues.length} issue(s)).`);
    }
    drafts = parsed.data.opportunities;
  }

  const created: string[] = [];
  let skipped = 0;
  for (const draft of drafts) {
    // Dedupe: skip when an identical open opportunity already exists.
    const duplicate = await db.opportunity.findFirst({
      where: { title: draft.title, status: "open" },
    });
    if (duplicate) {
      skipped++;
      continue;
    }
    const { verified, dropped } = await resolveCitations(db, draft.citations);
    if (verified.length === 0) {
      skipped++; // ungrounded drafts never persist (FR-OPP-02 evidence rule)
      continue;
    }
    const description =
      dropped > 0
        ? `${draft.description}\n\nNote: ${dropped} cited reference(s) could not be verified and were removed.`
        : draft.description;
    const row = await db.opportunity.create({
      data: {
        organizationId,
        title: draft.title.slice(0, 200),
        description,
        evidence: verified as unknown as object,
        supportingData: draft.supportingData as unknown as object,
        competitors: draft.competitors.slice(0, 10).map((name) => ({ name })) as unknown as object,
        painPoints: draft.painPoints.slice(0, 10).map((theme) => ({ theme })) as unknown as object,
        differentiation: draft.differentiation.slice(0, 1000),
        confidence: draft.confidence,
        status: "open",
        provider: provider.name,
        model: provider.model,
        provenance: provider.name === "demo" ? "demo" : "ai",
      },
    });
    created.push(row.id);
  }
  return { created, skipped };
}

/**
 * Catalog sync: detect genuinely new rows since the last completed sync and
 * emit ChangeEvents + Alerts for them. Baseline derives from job history (no
 * extra state); (type, refId) dedupe makes reruns idempotent. On static demo
 * data this correctly finds nothing — events correspond to real DB diffs only,
 * never simulated activity.
 */
export async function handleCatalogSync(
  organizationId: string,
): Promise<{ newEvents: number; newAlerts: number }> {
  const db = createTenantClient(organizationId);

  // Explicit baseline (SyncState, set at seed/provision and advanced per sync).
  // Missing row = never baselined → bootstrap now (report nothing this run).
  let state = await db.syncState.findUnique({ where: { organizationId } });
  if (!state) {
    state = await db.syncState.create({ data: { organizationId, lastSyncAt: new Date() } });
    return { newEvents: 0, newAlerts: 0 };
  }
  const baseline = state.lastSyncAt;

  const [products, ads, reviews] = await Promise.all([
    db.product.findMany({
      where: { firstSeen: { gt: baseline } },
      select: { id: true, name: true, store: { select: { name: true } } },
    }),
    db.ad.findMany({
      where: { firstSeen: { gt: baseline } },
      select: { id: true, title: true, advertiser: { select: { name: true } } },
    }),
    db.review.findMany({
      where: { createdAt: { gt: baseline } },
      select: {
        id: true,
        rating: true,
        product: { select: { name: true } },
        store: { select: { name: true } },
      },
    }),
  ]);

  let newEvents = 0;
  let newAlerts = 0;
  const emit = async (
    itemType: "product" | "store" | "advertiser" | "competitor" | "ad" | "review",
    refId: string,
    type: "new_product" | "new_ad" | "review_change",
    summary: string,
  ): Promise<void> => {
    const existing = await db.changeEvent.findFirst({ where: { type, refId } });
    if (existing) return;
    const event = await db.changeEvent.create({
      data: { organizationId, itemType, refId, type, summary, detectedAt: new Date() },
    });
    newEvents++;
    // Watchlisted entities alert high; everything else alerts medium (awareness).
    const watched = await db.watchlistItem.findFirst({ where: { refId } });
    await db.alert.create({
      data: { organizationId, changeEventId: event.id, severity: watched ? "high" : "medium" },
    });
    newAlerts++;
  };

  for (const p of products) {
    await emit("product", p.id, "new_product", `${p.store.name} listed a new product: ${p.name}.`);
  }
  for (const a of ads) {
    await emit("ad", a.id, "new_ad", `${a.advertiser.name} started a new ad: ${a.title}.`);
  }
  for (const r of reviews) {
    const subject = r.product?.name ?? r.store?.name ?? "a product";
    await emit("review", r.id, "review_change", `New ${r.rating}★ review on ${subject}.`);
  }
  await db.syncState.update({
    where: { organizationId },
    data: { lastSyncAt: new Date() },
  });
  return { newEvents, newAlerts };
}
