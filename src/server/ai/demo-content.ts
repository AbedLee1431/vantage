import type {
  AdAnalysisResult,
  AnalysisSection,
  CompetitorAnalysisResult,
  EvidenceRef,
  MarketingAngle,
} from "@/lib/ai";

/**
 * Demo AI content (no model, no network). Every builder reads ONLY the evidence
 * passed in, extracts/labels transparently, hedges everything, and marks output
 * as demo. Nothing here understands language — keyword counts and templates.
 */

const DEMO_DISCLAIMER = "Demo AI — deterministic templates, not a language model.";
const NO_PERF = "No spend, impression, or conversion data exists, so success cannot be assessed.";
const VALIDATE = "Validate against real data before acting on any of this.";

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
  };
  store: { id: string; name: string; domain: string; category: string } | null;
  advertiser: { id: string; name: string; platform: string };
  storeAdCount: number;
};

const section = (
  key: string,
  title: string,
  observed: string[],
  interpretation: string,
  extra?: Partial<
    Pick<AnalysisSection, "calculated" | "assumption" | "needsValidation" | "confidence">
  >,
): AnalysisSection => ({
  key,
  title,
  observed,
  calculated: extra?.calculated ?? [],
  interpretation: `${interpretation} [Demo heuristic — ${DEMO_DISCLAIMER}]`,
  assumption: extra?.assumption,
  needsValidation: extra?.needsValidation ?? VALIDATE,
  confidence: extra?.confidence ?? "low",
});

const ANGLE_KEYWORDS: { angle: MarketingAngle; words: string[] }[] = [
  {
    angle: "price",
    words: ["$", "discount", "sale", "free", "save", "cheap", "%", "deal", "price"],
  },
  { angle: "urgency", words: ["now", "limited", "last chance", "ends", "hurry", "today only"] },
  {
    angle: "social-proof",
    words: ["review", "rated", "customers", "bestseller", "loved", "popular", "trusted"],
  },
  {
    angle: "convenience",
    words: ["easy", "simple", "delivered", "automatic", "effortless", "quick"],
  },
  { angle: "transformation", words: ["before", "after", "transform", "new you", "makeover"] },
  {
    angle: "problem-solution",
    words: ["fix", "solution", "stop", "end", "solve", "tired", "struggling"],
  },
  { angle: "comparison", words: [" vs ", "better than", "unlike", "compared"] },
  { angle: "demonstration", words: ["watch", "see how", "demo", "tour", "walkthrough"] },
];

function scoreAngle(text: string): { angle: MarketingAngle; evidence: string[] } {
  const lower = ` ${text.toLowerCase()} `;
  let best: MarketingAngle = "unclear";
  let bestHits: string[] = [];
  for (const { angle, words } of ANGLE_KEYWORDS) {
    const hits = words.filter((w) => lower.includes(w.toLowerCase()));
    if (hits.length > bestHits.length) {
      best = angle;
      bestHits = hits;
    }
  }
  return { angle: best, evidence: bestHits.map((w) => `keyword “${w}”`) };
}

function firstSentence(text: string | null, fallback: string): string {
  if (!text) return fallback;
  const match = text.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : text).trim().slice(0, 160);
}

export function buildDemoAdAnalysis(ev: AdEvidence): AdAnalysisResult {
  const copy = [ev.ad.title, ev.ad.primaryText ?? "", ev.ad.headline ?? "", ev.ad.cta ?? ""].join(
    "\n",
  );
  const { angle, evidence: angleEvidence } = scoreAngle(copy);
  const hookSource = ev.ad.primaryText ?? ev.ad.title;

  const sections: AnalysisSection[] = [
    section(
      "hook",
      "Hook",
      [`Opens with: “${firstSentence(hookSource, ev.ad.title)}”`],
      "The opening leads with product identity and setting. Position-in-text only.",
      { assumption: "Assumes readers start at the first line.", confidence: "low" },
    ),
    section(
      "problem",
      "Problem",
      ev.ad.primaryText?.match(/tired|struggling|problem|fix|sensitive|dry|cold|blister/i)
        ? [
            `Mentions: “${ev.ad.primaryText.match(/[^.!?]*?(tired|struggling|problem|fix|sensitive|dry|cold|blister)[^.!?]*[.!?]/i)?.[0].trim()}”`,
          ]
        : ["No explicit problem statement detected (keyword scan)."],
      "Problem framing, if any, is mild and product-led rather than pain-led.",
    ),
    section(
      "promise",
      "Promise",
      ev.ad.headline ? [`Headline promises: “${ev.ad.headline}”`] : ["No separate headline."],
      "The promise is the product benefit in the headline or title; no outcome is guaranteed.",
      { needsValidation: "Promises need customer validation; none exists in demo data." },
    ),
    section(
      "offer",
      "Offer",
      /\$\d+/.test(copy)
        ? [`Contains a price figure: “${copy.match(/\$\d[\d.,]*/)?.[0]}”`]
        : ["No explicit price, discount, or bundle detected in the copy."],
      "Offer strength cannot be judged without pricing and margin context.",
    ),
    section(
      "structure",
      "Creative Structure",
      [
        `Format: ${ev.ad.format}.`,
        `Has headline: ${ev.ad.headline ? "yes" : "no"}. Has CTA: ${ev.ad.cta ? "yes" : "no"}. Has primary text: ${ev.ad.primaryText ? "yes" : "no"}.`,
      ],
      "Inventory of parts only — Demo AI cannot judge creative quality.",
      { confidence: "low" },
    ),
    section(
      "cta",
      "CTA",
      ev.ad.cta ? [`Requests: “${ev.ad.cta}”`] : ["No call to action detected."],
      ev.ad.cta
        ? /shop|buy|order|get/i.test(ev.ad.cta)
          ? "Purchase-oriented wording (keyword match)."
          : "Information-oriented wording (keyword match)."
        : "Missing CTA is itself an observation worth noting.",
    ),
    section(
      "audience",
      "Audience Hypothesis",
      ev.store
        ? [`Advertised by ${ev.store.name} (${ev.store.category}).`]
        : ["No linked store in the dataset."],
      "Likely buyers resemble the store's category audience. This is a guess from category alone.",
      {
        assumption:
          "Assumes category describes the buyer; ignores platform, geography, and creative targeting, none of which are in the data.",
        needsValidation: "Audience claims need platform or customer data.",
      },
    ),
    section(
      "angle",
      "Marketing Angle",
      angle === "unclear"
        ? ["No angle keywords matched."]
        : [`Strongest keyword signal: ${angle} (${angleEvidence.join(", ")}).`],
      angle === "unclear"
        ? "Angle is unclear from keywords alone."
        : `Reads most like a ${angle} angle by keyword count — a starting hypothesis, not a finding.`,
    ),
  ];

  return {
    sections,
    angle,
    angleEvidence,
    disclaimers: [DEMO_DISCLAIMER, NO_PERF, VALIDATE],
  };
}

export type CompetitorEvidence = {
  store: {
    id: string;
    name: string;
    domain: string;
    category: string;
    country: string;
    platform: string;
    description: string | null;
  };
  products: { id: string; name: string; category: string; price: number }[];
  adSummary: {
    total: number;
    active: number;
    byPlatform: Record<string, number>;
    byFormat: Record<string, number>;
  };
  landingPages: { id: string; url: string; title: string | null }[];
  reviewSummary: {
    count: number;
    avg: number | null;
    recent: { rating: number; title: string | null }[];
  };
  changes: { type: string; summary: string; detectedAt: Date }[];
  tracked: boolean;
};

export function buildDemoCompetitorAnalysis(ev: CompetitorEvidence): CompetitorAnalysisResult {
  const prices = ev.products.map((p) => p.price);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const categories = [...new Set(ev.products.map((p) => p.category))];

  const s = (
    key: string,
    title: string,
    observed: string[],
    interpretation: string,
    extra?: Partial<Pick<AnalysisSection, "calculated" | "assumption" | "needsValidation">>,
  ) => section(key, title, observed, interpretation, extra);

  const sections: AnalysisSection[] = [
    s(
      "overview",
      "Store Overview",
      [
        `${ev.store.name} (${ev.store.domain}), ${ev.store.category}, ${ev.store.country}, on ${ev.store.platform}.`,
        ev.store.description ?? "No description in the dataset.",
        ev.tracked ? "Currently on your tracked-competitor list." : "Not on your tracked list.",
      ],
      "Directory facts only; nothing here implies strategy.",
    ),
    s(
      "product-strategy",
      "Product Strategy",
      ev.products.length
        ? [
            `${ev.products.length} products observed.`,
            `Categories: ${categories.join(", ") || "—"}.`,
          ]
        : ["No products in the dataset for this store."],
      ev.products.length
        ? "Catalog breadth and category mix are visible; intent behind them is not."
        : "Cannot assess product strategy with no products observed.",
      {
        calculated: prices.length ? [`Observed price span across ${prices.length} products.`] : [],
        needsValidation: "Assortment strategy needs catalog history and sell-through data.",
      },
    ),
    s(
      "pricing",
      "Pricing",
      minPrice !== null
        ? [`Observed prices from $${minPrice.toFixed(2)} to $${maxPrice!.toFixed(2)}.`]
        : ["No prices observed."],
      "Price points are facts; positioning inferences from them are guesses.",
      {
        calculated: avgPrice !== null ? [`Average observed price $${avgPrice.toFixed(2)}.`] : [],
        assumption: "Assumes listed prices equal selling prices (no discounts observed).",
      },
    ),
    s(
      "advertising",
      "Advertising Activity",
      ev.adSummary.total
        ? [
            `${ev.adSummary.total} ads observed (${ev.adSummary.active} active).`,
            `By platform: ${
              Object.entries(ev.adSummary.byPlatform)
                .map(([k, v]) => `${k} ${v}`)
                .join(", ") || "—"
            }.`,
            `By format: ${
              Object.entries(ev.adSummary.byFormat)
                .map(([k, v]) => `${k} ${v}`)
                .join(", ") || "—"
            }.`,
          ]
        : ["No ads observed for this store."],
      ev.adSummary.total
        ? "Activity volume is visible; spend, reach, and effectiveness are not."
        : "Absence from the dataset is not evidence of absence in the market.",
      { needsValidation: "Ad activity needs platform data to confirm." },
    ),
    s(
      "creative",
      "Creative Strategy",
      ev.adSummary.total
        ? [`${Object.keys(ev.adSummary.byFormat).length} format(s) in use.`]
        : ["No creatives to assess."],
      "Format mix hints at production range; message strategy needs per-ad analysis (Phase 4 ad analysis covers single ads).",
    ),
    s(
      "landing",
      "Landing Pages",
      ev.landingPages.length
        ? ev.landingPages.map((l) => `${l.title ?? "Untitled"} — ${l.url}`)
        : ["No landing pages in the dataset."],
      "Page existence is observed; page quality and conversion role are not.",
    ),
    s(
      "feedback",
      "Customer Feedback",
      ev.reviewSummary.count
        ? [
            `${ev.reviewSummary.count} reviews observed${ev.reviewSummary.avg !== null ? `, average ${ev.reviewSummary.avg.toFixed(1)}/5` : ""}.`,
            ...ev.reviewSummary.recent.map((r) => `★${r.rating} — ${r.title ?? "(no title)"}`),
          ]
        : ["No reviews in the dataset."],
      ev.reviewSummary.count
        ? "Counts and averages are arithmetic; sentiment themes need review text analysis (Phase 5)."
        : "Cannot assess customer sentiment with no reviews observed.",
    ),
    s(
      "positioning",
      "Positioning",
      [
        `Category: ${ev.store.category}.`,
        minPrice !== null
          ? `Price span $${minPrice.toFixed(2)}–$${maxPrice!.toFixed(2)}.`
          : "No pricing observed.",
      ],
      "Positioning is inferred from category + price alone — a thin basis, stated as hypothesis.",
      {
        assumption:
          "Assumes category and price are the main positioning axes; brand, quality, and service are invisible here.",
      },
    ),
    s(
      "changes",
      "Observed Changes",
      ev.changes.length
        ? ev.changes.map((c) => `${c.summary} (${c.detectedAt.toISOString().slice(0, 10)})`)
        : ["No tracked changes in the dataset."],
      "Changes are ledger entries; their business significance is unknown.",
    ),
    s(
      "insights",
      "AI Insights",
      ["Demo AI produced no model insights (no language model ran)."],
      "This section intentionally contains no interpretation in Demo mode.",
      { needsValidation: "Connect an AI provider for model-generated insights." },
    ),
    s(
      "opportunities",
      "Opportunities to Investigate",
      ev.reviewSummary.count
        ? [
            `${ev.reviewSummary.count} reviews exist — recurring complaints would surface in Phase 5 analysis.`,
          ]
        : ["Thin data: few products, ads, or reviews observed, so gaps cannot be evidenced yet."],
      "Leads, not findings. Each needs validation against customer and market data.",
      { needsValidation: "Opportunity claims need Phase 5 evidence (reviews, gaps)." },
    ),
  ];

  return {
    sections,
    disclaimers: [DEMO_DISCLAIMER, NO_PERF, VALIDATE],
  };
}

export type ChatBundle = {
  products: { id: string; name: string; category: string; price: number; storeName: string }[];
  stores: { id: string; name: string; domain: string; category: string; productCount: number }[];
  ads: {
    id: string;
    title: string;
    platform: string;
    format: string;
    status: string;
    advertiserName: string;
  }[];
  reviews: {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    productName: string | null;
  }[];
  changes: { type: string; summary: string }[];
  trends: string[];
  opportunities: { id: string; title: string; confidence: string }[];
  counts: { products: number; stores: number; ads: number; reviews: number };
};

const THEME_WORDS: { theme: string; words: string[] }[] = [
  { theme: "shipping", words: ["ship", "deliver", "track", "package", "arriv", "slow", "late"] },
  {
    theme: "quality",
    words: ["quality", "broke", "defect", "pill", "size", "fit", "small", "tear"],
  },
  { theme: "price", words: ["price", "expensive", "cheap", "worth", "cost", "overpriced"] },
  { theme: "service", words: ["support", "return", "refund", "service", "helpful", "rude"] },
];

function themeHits(text: string): string[] {
  const lower = text.toLowerCase();
  return THEME_WORDS.filter((t) => t.words.some((w) => lower.includes(w))).map((t) => t.theme);
}

function refList(refs: EvidenceRef[]): string {
  if (refs.length === 0) return "";
  return `\n\nSources: ${refs.map((r) => `${r.type} ${r.id} (${r.label})`).join("; ")}.`;
}

/** Deterministic Demo answer from a tool-gathered bundle. Never invents. */
export function buildDemoChatAnswer(
  question: string,
  bundle: ChatBundle,
): { text: string; refs: EvidenceRef[] } {
  const q = question.toLowerCase();
  const demoNote =
    "\n\n_Demo AI: keyword matching + templates, not a language model. Connect an AI provider for real analysis._";
  const totalRows =
    bundle.counts.products + bundle.counts.stores + bundle.counts.ads + bundle.counts.reviews;
  if (totalRows === 0) {
    return {
      text:
        "No data is available in this workspace yet. Add products, stores, ads, or reviews (or run the demo seed), then ask again." +
        demoNote,
      refs: [],
    };
  }

  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("complaint", "review", "pain", "rating", "sentiment", "angry", "bad", "issue")) {
    const lows = bundle.reviews.filter((r) => r.rating <= 3);
    if (lows.length === 0) {
      return {
        text: `I found ${bundle.reviews.length} review(s) and none rated 3★ or below, so there are no complaints to summarize in the observed data.${demoNote}`,
        refs: [],
      };
    }
    const themeCounts = new Map<string, number>();
    for (const r of lows) {
      for (const t of themeHits(`${r.title ?? ""} ${r.body}`)) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }
    }
    const lines = lows
      .slice(0, 5)
      .map((r) => `★${r.rating} ${r.title ?? "(no title)"} — ${r.body.slice(0, 120)}`);
    const refs = lows
      .slice(0, 5)
      .map((r): EvidenceRef => ({ type: "review", id: r.id, label: r.title ?? "review" }));
    return {
      text:
        `From ${lows.length} review(s) rated 3★ or below (keyword scan, not sentiment understanding):\n` +
        [...themeCounts.entries()].map(([t, n]) => `• ${t}: mentioned in ${n}`).join("\n") +
        `\n\nExamples:\n${lines.map((l) => `• ${l}`).join("\n")}` +
        refList(refs) +
        demoNote,
      refs,
    };
  }

  if (has("compar", " vs ", "versus", "difference between")) {
    const names = bundle.stores.map((s) => s.name);
    const mentioned = names.filter((n) => q.includes(n.toLowerCase()));
    const pair = mentioned.length >= 2 ? mentioned.slice(0, 2) : names.slice(0, 2);
    if (pair.length < 2) {
      return {
        text: "I need two stores to compare. Name them (e.g. “compare X and Y”).",
        refs: [],
      };
    }
    const rows = pair.map((name) => {
      const s = bundle.stores.find((x) => x.name === name)!;
      const prods = bundle.products.filter((p) => p.storeName === name);
      const prices = prods.map((p) => p.price);
      return {
        s,
        count: prods.length,
        min: prices.length ? Math.min(...prices) : null,
        max: prices.length ? Math.max(...prices) : null,
      };
    });
    const refs = rows.map((r): EvidenceRef => ({ type: "store", id: r.s.id, label: r.s.name }));
    return {
      text:
        `Side-by-side facts (observed only, no verdict):\n` +
        rows
          .map(
            (r) =>
              `• ${r.s.name} (${r.s.domain}, ${r.s.category}): ${r.count} product(s)` +
              (r.min !== null ? `, $${r.min}–$${r.max}` : ""),
          )
          .join("\n") +
        `\n\nWhich is “better” depends on what you value — that judgment needs validation.` +
        refList(refs) +
        demoNote,
      refs,
    };
  }

  if (has("trend", "momentum", "growing", "emerging", "opportunit")) {
    const refs: EvidenceRef[] = [];
    const oppLines =
      bundle.opportunities.length > 0
        ? `\n\nOpen opportunities (recorded, worth investigating):\n` +
          bundle.opportunities.map((o) => `• ${o.title} (confidence: ${o.confidence})`).join("\n") +
          `\nSee the opportunities page for evidence behind each.`
        : `\n\nNo open opportunities recorded — run gap analysis from the opportunities page.`;
    return {
      text:
        `Observed trend summary:\n${bundle.trends.map((t) => `• ${t}`).join("\n")}` +
        oppLines +
        `\n\nCounts and recorded leads from demo data, not market proof.` +
        refList(refs) +
        demoNote,
      refs,
    };
  }

  if (has("ad", "angle", "hook", "creative", "campaign")) {
    const byPlatform = new Map<string, number>();
    for (const a of bundle.ads) byPlatform.set(a.platform, (byPlatform.get(a.platform) ?? 0) + 1);
    const refs = bundle.ads
      .slice(0, 5)
      .map((a): EvidenceRef => ({ type: "ad", id: a.id, label: a.title }));
    return {
      text:
        `Observed ${bundle.ads.length} ad(s): ` +
        [...byPlatform.entries()].map(([p, n]) => `${p} ${n}`).join(", ") +
        `.\n` +
        bundle.ads
          .slice(0, 5)
          .map((a) => `• “${a.title}” (${a.platform}/${a.format}, ${a.status})`)
          .join("\n") +
        `\n\nFor per-ad hook/angle breakdowns, run AI ad analysis on an ad page.` +
        refList(refs) +
        demoNote,
      refs,
    };
  }

  if (has("competitor", "store", "brand", "shop")) {
    const match = bundle.stores.find((s) => q.includes(s.name.toLowerCase()));
    if (!match) {
      const refs = bundle.stores
        .slice(0, 5)
        .map((s): EvidenceRef => ({ type: "store", id: s.id, label: s.name }));
      return {
        text:
          `Tracked stores (${bundle.stores.length}):\n` +
          bundle.stores
            .slice(0, 5)
            .map((s) => `• ${s.name} (${s.domain}, ${s.category}, ${s.productCount} products)`)
            .join("\n") +
          `\n\nName a store for its facts, or open a competitor analysis from its page.` +
          refList(refs) +
          demoNote,
        refs,
      };
    }
    const prods = bundle.products.filter((p) => p.storeName === match.name);
    const refs: EvidenceRef[] = [
      { type: "store", id: match.id, label: match.name },
      ...prods.slice(0, 3).map((p): EvidenceRef => ({ type: "product", id: p.id, label: p.name })),
    ];
    return {
      text:
        `${match.name} (${match.domain}, ${match.category}): ${prods.length} product(s) observed` +
        (prods.length
          ? `: ${prods
              .slice(0, 5)
              .map((p) => `${p.name} ($${p.price})`)
              .join("; ")}`
          : ".") +
        `\n\nFor the full 11-section breakdown, run competitor analysis from the store page.` +
        refList(refs) +
        demoNote,
      refs,
    };
  }

  if (has("product", "price", "pricing", "cost", "cheap", "expensive")) {
    const match = bundle.products.find((p) => q.includes(p.name.toLowerCase().split(" ")[0] ?? ""));
    if (match) {
      return {
        text: `${match.name} (${match.category}) — $${match.price} at ${match.storeName}, first seen in the demo dataset. No sales or performance data exists.`,
        refs: [{ type: "product", id: match.id, label: match.name }],
      };
    }
    const refs = bundle.products
      .slice(0, 5)
      .map((p): EvidenceRef => ({ type: "product", id: p.id, label: p.name }));
    return {
      text:
        `${bundle.products.length} product(s) observed:\n` +
        bundle.products
          .slice(0, 8)
          .map((p) => `• ${p.name} — $${p.price} (${p.storeName})`)
          .join("\n") +
        refList(refs) +
        demoNote,
      refs,
    };
  }

  if (has("chang", "new", "update", "alert", "happen")) {
    if (bundle.changes.length === 0) {
      return { text: "No tracked changes in the dataset.", refs: [] };
    }
    return {
      text:
        `Recent tracked changes:\n` +
        bundle.changes
          .slice(0, 8)
          .map((c) => `• [${c.type}] ${c.summary}`)
          .join("\n") +
        demoNote,
      refs: [],
    };
  }

  return {
    text:
      `I can report what is in this workspace (${bundle.counts.products} products, ${bundle.counts.stores} stores, ${bundle.counts.ads} ads, ${bundle.counts.reviews} reviews — all demo data). ` +
      `Ask about complaints, a competitor by name, ad angles, trends, a product comparison, prices, or recent changes — I answer only from retrieved rows.` +
      demoNote,
    refs: [],
  };
}

// ── Phase 5: review summaries + opportunities (deterministic templates) ─────

export type ReviewSummaryEvidence = {
  scopeLabel: string;
  total: number;
  avg: number | null;
  distribution: { stars: number; count: number }[];
  painThemes: {
    theme: string;
    count: number;
    quotes: { id: string; rating: number; quote: string }[];
  }[];
  featureRequests: {
    theme: string;
    count: number;
    quotes: { id: string; rating: number; quote: string }[];
  }[];
  reviewIds: string[];
};

export function buildDemoReviewSummary(ev: ReviewSummaryEvidence): {
  sections: AnalysisSection[];
  disclaimers: string[];
  citations: string[];
} {
  const dist = ev.distribution.map((d) => `${d.stars}★×${d.count}`).join(", ");
  const sections: AnalysisSection[] = [
    section(
      "sentiment",
      "Overall Sentiment",
      [
        `${ev.total} review(s) in scope (${ev.scopeLabel}).`,
        ev.avg !== null ? `Average rating ${ev.avg.toFixed(1)}/5.` : "No ratings to average.",
        `Distribution: ${dist}.`,
      ],
      ev.total
        ? "Averages summarize stated ratings only; they are not satisfaction proof."
        : "No reviews observed, so sentiment cannot be assessed.",
      {
        calculated: ev.total ? [`${ev.total} reviews aggregated by star count.`] : [],
        needsValidation: ev.total
          ? "Star ratings need review-text context to interpret."
          : "Add reviews to enable this section.",
      },
    ),
  ];
  for (const theme of ev.painThemes.slice(0, 5)) {
    sections.push(
      section(
        `pain-${theme.theme}`,
        `Pain: ${theme.theme}`,
        [
          `Mentioned in ${theme.count} review(s) (keyword match).`,
          ...theme.quotes.slice(0, 2).map((q) => `★${q.rating} — “${q.quote.slice(0, 140)}”`),
        ],
        `Recurring ${theme.theme} mentions suggest a real friction point worth investigating — suggestion from counts, not understanding.`,
        { needsValidation: "Confirm with more reviews and order/support data before acting." },
      ),
    );
  }
  if (ev.featureRequests.length > 0) {
    const fr = ev.featureRequests[0]!;
    sections.push(
      section(
        "requests",
        "Feature Requests",
        [
          `${fr.count} request(s) detected (wish/should/add language).`,
          ...fr.quotes.slice(0, 2).map((q) => `★${q.rating} — “${q.quote.slice(0, 140)}”`),
        ],
        "Requests are explicit customer asks — the strongest signal here, still needing demand sizing.",
      ),
    );
  }
  sections.push(
    section(
      "limits",
      "What Demo Cannot Do",
      ["Demo AI counts keywords; it does not understand sentiment, sarcasm, or context."],
      "Treat every theme as a lead for human reading, not a finding.",
    ),
  );
  return {
    sections,
    disclaimers: [DEMO_DISCLAIMER, "Keyword counts, not sentiment understanding.", VALIDATE],
    citations: ev.reviewIds.slice(0, 10),
  };
}

export type OpportunityEvidence = {
  products: { id: string; name: string; category: string; price: number; storeName: string }[];
  reviewThemes: { theme: string; count: number; quotes: { id: string; quote: string }[] }[];
  featureRequests: { count: number; quotes: { id: string; quote: string }[] }[];
  stores: { id: string; name: string }[];
};

export type OpportunityDraftLocal = {
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

const DIFFERENTIATION: Record<string, string> = {
  shipping: "Compete on reliable, well-communicated fulfillment.",
  quality: "Compete on durability, fit consistency, and quality control.",
  price: "Compete on a transparent value tier with clear trade-offs.",
  service: "Compete on responsive, human support and easy returns.",
};

export function buildDemoOpportunities(ev: OpportunityEvidence): OpportunityDraftLocal[] {
  const out: OpportunityDraftLocal[] = [];

  for (const theme of ev.reviewThemes.filter((t) => t.count >= 2)) {
    const ids = theme.quotes.map((q) => q.id);
    out.push({
      title: `Address recurring ${theme.theme} complaints`,
      description: `Customers mention ${theme.theme} in ${theme.count} review(s). Worth investigating whether a ${DIFFERENTIATION[theme.theme] ?? "focused"} position would win them over. Demo template — validate demand first.`,
      evidence: [
        `${theme.count} review(s) mention ${theme.theme} (keyword match).`,
        ...theme.quotes.slice(0, 2).map((q) => `“${q.quote.slice(0, 120)}”`),
      ],
      supportingData: { theme: theme.theme, mentions: theme.count },
      competitors: ev.stores.map((s) => s.name),
      painPoints: [theme.theme],
      differentiation: DIFFERENTIATION[theme.theme] ?? "Investigate what buyers value most.",
      confidence: theme.count >= 3 ? "medium" : "low",
      citations: ids,
    });
  }

  if (ev.featureRequests.length > 0) {
    const fr = ev.featureRequests[0]!;
    out.push({
      title: "Build what customers explicitly request",
      description: `${fr.count} review(s) contain direct feature requests. Worth investigating after sizing demand. Demo template — validate before building.`,
      evidence: fr.quotes.slice(0, 3).map((q) => `“${q.quote.slice(0, 120)}”`),
      supportingData: { requests: fr.count },
      competitors: ev.stores.map((s) => s.name),
      painPoints: ["feature requests"],
      differentiation: "Ship the smallest version of the most-requested item first.",
      confidence: fr.count >= 2 ? "medium" : "low",
      citations: fr.quotes.map((q) => q.id),
    });
  }

  const byCategory = new Map<string, { id: string; price: number }[]>();
  for (const p of ev.products) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push({ id: p.id, price: p.price });
  }
  for (const [category, items] of byCategory) {
    if (items.length < 2) continue;
    const prices = items.map((i) => i.price);
    const low = prices.filter((p) => p < 50);
    const high = prices.filter((p) => p > 100);
    const mid = prices.filter((p) => p >= 50 && p <= 100);
    if (low.length > 0 && high.length > 0 && mid.length === 0) {
      out.push({
        title: `Mid-tier pricing gap in ${category}`,
        description: `Observed ${category} prices cluster below $50 and above $100 with nothing between. Worth investigating whether a mid-tier offer fits. Thin-data heuristic — validate demand.`,
        evidence: [`Prices observed: ${prices.map((p) => `$${p}`).join(", ")}.`],
        supportingData: { category, low: low.length, high: high.length, mid: 0 },
        competitors: ev.stores.map((s) => s.name),
        painPoints: [],
        differentiation: "A mid-tier offer with clear quality trade-offs.",
        confidence: "low",
        citations: items.map((i) => i.id),
      });
    }
  }

  return out;
}

// ── Phase 7: report summaries (deterministic templates from fact sheets) ────

export function buildDemoReportSummary(
  type: string,
  title: string,
  factSheet: Record<string, unknown>,
): { summary: string; findings: string[] } {
  const entries = Object.entries(factSheet)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  const summary =
    `This ${type} report (“${title}”) consolidates observed workspace data` +
    (entries ? `: ${entries}.` : ".") +
    ` All figures are observed or calculated from demo rows; no external benchmarks apply. Demo template — connect an AI provider for model-written summaries.`;
  const numeric = Object.entries(factSheet).filter(([, v]) => typeof v === "number");
  const findings = numeric.slice(0, 5).map(([k, v]) => `Observed ${k}: ${v} (demo data).`);
  if (findings.length === 0) findings.push("Coverage is thin — add data for richer findings.");
  findings.push("Validate every observation against real sources before acting.");
  return { summary, findings: findings.slice(0, 6) };
}
