/**
 * Review insights computation (FR-REV-02). Pure functions over observed rows:
 * rating arithmetic + transparent keyword buckets. No NLP, no model — callers
 * label output Calculated; AI prose summaries arrive separately (FR-REV-03).
 */

export type ReviewInput = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  date: Date;
  productName: string | null;
  storeName: string | null;
};

export type ThemeBucket = {
  theme: string;
  count: number;
  examples: { id: string; rating: number; quote: string }[];
};

export type SentimentSummary = {
  count: number;
  avg: number | null;
  distribution: { stars: number; count: number }[];
  positive: number;
  neutral: number;
  negative: number;
};

export type InsightsResult = {
  sentiment: SentimentSummary;
  positiveThemes: ThemeBucket[];
  negativeThemes: ThemeBucket[];
  featureRequests: ThemeBucket[];
  useContexts: ThemeBucket[];
};

const THEMES: { theme: string; words: string[] }[] = [
  {
    theme: "shipping",
    words: ["ship", "deliver", "track", "package", "arriv", "slow", "late", "postage"],
  },
  {
    theme: "quality",
    words: ["quality", "broke", "defect", "pill", "size", "fit", "small", "tear", "seam", "zip"],
  },
  {
    theme: "price",
    words: ["price", "expensive", "cheap", "worth", "cost", "overpriced", "value", "afford"],
  },
  {
    theme: "service",
    words: ["support", "return", "refund", "service", "helpful", "rude", "response"],
  },
];

const REQUEST_WORDS = [
  "wish",
  "should",
  "please",
  "would love",
  "missing",
  "hope",
  "suggest",
  "add",
  "more pockets",
  "if only",
];

const USE_WORDS = [
  "hik",
  "trail",
  "travel",
  "daily",
  "gift",
  "work",
  "run",
  "camp",
  "beach",
  "kitchen",
  "office",
  "sensitive",
  "winter",
];

function textOf(r: ReviewInput): string {
  return `${r.title ?? ""} ${r.body}`.toLowerCase();
}

function bucket(
  rows: ReviewInput[],
  words: string[],
  theme: string,
  maxExamples = 2,
): ThemeBucket | null {
  const hits = rows.filter((r) => {
    const text = textOf(r);
    return words.some((w) => text.includes(w));
  });
  if (hits.length === 0) return null;
  return {
    theme,
    count: hits.length,
    examples: hits.slice(0, maxExamples).map((r) => ({
      id: r.id,
      rating: r.rating,
      quote: `${r.title ? `${r.title} — ` : ""}${r.body.slice(0, 140)}`,
    })),
  };
}

export function computeInsights(reviews: ReviewInput[]): InsightsResult {
  const ratings = reviews.map((r) => r.rating);
  const count = ratings.length;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratings.filter((r) => r === stars).length,
  }));
  const sentiment: SentimentSummary = {
    count,
    avg: count ? ratings.reduce((a, b) => a + b, 0) / count : null,
    distribution,
    positive: ratings.filter((r) => r >= 4).length,
    neutral: ratings.filter((r) => r === 3).length,
    negative: ratings.filter((r) => r <= 2).length,
  };

  const positive = reviews.filter((r) => r.rating >= 4);
  const negative = reviews.filter((r) => r.rating <= 3);

  const positiveThemes: ThemeBucket[] = [];
  for (const t of THEMES) {
    const b = bucket(positive, t.words, t.theme);
    if (b) positiveThemes.push(b);
  }
  positiveThemes.sort((a, b) => b.count - a.count);

  const negativeThemes: ThemeBucket[] = [];
  for (const t of THEMES) {
    const b = bucket(negative, t.words, t.theme);
    if (b) negativeThemes.push(b);
  }
  negativeThemes.sort((a, b) => b.count - a.count);

  const featureRequests: ThemeBucket[] = [];
  const fr = bucket(reviews, REQUEST_WORDS, "feature requests", 3);
  if (fr) featureRequests.push(fr);

  const useContexts: ThemeBucket[] = [];
  for (const word of USE_WORDS) {
    const b = bucket(reviews, [word], word, 1);
    if (b) useContexts.push(b);
  }
  useContexts.sort((a, b) => b.count - a.count);

  return { sentiment, positiveThemes, negativeThemes, featureRequests, useContexts };
}

/** Top pain points = negative themes by frequency (for opportunity evidence). */
export function painPoints(insights: InsightsResult): ThemeBucket[] {
  return insights.negativeThemes;
}
