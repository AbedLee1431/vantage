import { z } from "zod";

/**
 * Live-model prompts + response schemas (spec §16, §22). Versioned: bump
 * PROMPT_VERSION to invalidate cached analyses when prompts change.
 */

export const PROMPT_VERSION = "v1";

const sectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  observed: z.array(z.string()),
  calculated: z.array(z.string()),
  interpretation: z.string(),
  assumption: z.string().optional(),
  needsValidation: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const adAnalysisResultSchema = z.object({
  sections: z.array(sectionSchema).min(1),
  angle: z.enum([
    "price",
    "convenience",
    "transformation",
    "problem-solution",
    "social-proof",
    "urgency",
    "comparison",
    "demonstration",
    "unclear",
  ]),
  angleEvidence: z.array(z.string()),
  disclaimers: z.array(z.string()),
});

export const competitorAnalysisResultSchema = z.object({
  sections: z.array(sectionSchema).min(1),
  disclaimers: z.array(z.string()),
});

export const AD_ANALYSIS_SYSTEM = `You analyze e-commerce advertisements from observed database records. Rules you must follow:
1. ONLY use the evidence provided. Never invent metrics, reviews, performance data, or external facts. If data is missing, say it is missing.
2. Structure every section as: observed facts (quoted/cited from evidence) → calculated values → your interpretation (hedged) → explicit assumptions → what needs validation.
3. Hedge every interpretation: "The available data suggests…", "This may indicate…", "A possible explanation is…", "This should be validated…".
4. NEVER claim an ad is successful, will succeed, or drove revenue — no performance data exists.
5. Pick exactly one marketing angle from: price, convenience, transformation, problem-solution, social-proof, urgency, comparison, demonstration, unclear. Cite the words that support it.
6. Respond with JSON ONLY, matching the required schema. No prose outside JSON.`;

export const COMPETITOR_ANALYSIS_SYSTEM = `You analyze e-commerce competitors from observed database records. Rules you must follow:
1. ONLY use the evidence provided. Never invent products, prices, ads, reviews, or external facts. If a section has no data, state that explicitly and do not fill it with guesses.
2. Structure every section as: observed facts → calculated metrics → hedged interpretation → explicit assumptions → what needs validation.
3. Hedge: "The available data suggests…", "This may indicate…", "This should be validated before acting…".
4. NEVER present opportunities as guaranteed outcomes — frame them as leads worth investigating.
5. Respond with JSON ONLY, matching the required schema. No prose outside JSON.`;

export const ANALYST_SYSTEM = `You are an e-commerce research assistant. You answer ONLY from data returned by your tools, which query the user's own workspace database.
Rules:
1. ALWAYS call at least one tool before answering factual questions. Never answer from general knowledge about specific products, stores, ads, or reviews.
2. Cite record ids you actually received (e.g. product abc123). Never invent ids.
3. Separate facts (from tools) from interpretation (hedged: "suggests…", "may indicate…"). Label hypotheses as hypotheses.
4. If tools return nothing, say the data is unavailable and suggest what to add — do not fill gaps.
5. Never claim anything will succeed. Never present demo data as real-world fact.
6. Keep answers focused; reference underlying records where practical.`;

// ── Phase 5: review summaries + opportunities ───────────────────────────────

export const REVIEW_SUMMARY_SYSTEM = `You summarize customer pain points from observed review records. Rules:
1. ONLY use the reviews and computed themes provided. Never invent reviews, ratings, or complaints. If a scope has no reviews, say so and stop.
2. Structure output as sections (one per pain theme + one overall sentiment): observed quotes/counts → calculated shares → hedged interpretation → what needs validation.
3. Hedge everything: "recurring mentions suggest…", "may indicate…". Never diagnose product defects as fact — these are customer statements, not engineering findings.
4. List every review id you relied on in citations. Unverifiable ids will be removed.
5. Respond with JSON ONLY, matching the required schema. No prose outside JSON.`;

export const OPPORTUNITY_SYSTEM = `You identify market gaps worth investigating from workspace evidence (products, ads, reviews, stores). Rules:
1. ONLY use the evidence provided. Never invent gaps, competitors, prices, or demand. Every opportunity must trace to specific observed rows cited by id.
2. Each opportunity: title, hedged description ("worth investigating because…", never "will succeed"), evidence summary, supporting numbers, competitors observed, pain points addressed, potential differentiation, confidence (low/medium/high with reason), citations (record ids you used).
3. Frame everything as investigation, never business advice or guarantees.
4. If evidence is thin, return FEWER opportunities (even zero) with an explanation — never pad.
5. List every record id you relied on in each opportunity's citations. Unverifiable ids will be removed.
6. Respond with JSON ONLY: {"opportunities": [...]} matching the required schema. No prose outside JSON.`;

const opportunitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  evidence: z.array(z.string()).max(20),
  supportingData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  competitors: z.array(z.string()).max(10),
  painPoints: z.array(z.string()).max(10),
  differentiation: z.string().min(1).max(1000),
  confidence: z.enum(["low", "medium", "high"]),
  citations: z.array(z.string()).max(20),
});

export const opportunityListSchema = z.object({
  opportunities: z.array(opportunitySchema).max(10),
});

export type OpportunityDraft = z.infer<typeof opportunitySchema>;

// ── Phase 7: report summaries ───────────────────────────────────────────────

export const REPORT_SUMMARY_SYSTEM = `You write executive summaries for e-commerce intelligence reports from assembled facts. Rules:
1. ONLY use the facts provided. Never invent products, prices, counts, trends, or external benchmarks. If a section is thin, say coverage is limited.
2. Write a 2–4 sentence summary plus 3–5 key findings as short bullets. Hedge interpretations ("suggests…", "may indicate…"); label the single least certain finding as needing validation.
3. NEVER claim success, performance, or market outcomes — state what was observed.
4. Respond with JSON ONLY: {"summary": string, "findings": string[]}. No prose outside JSON.`;

export const reportSummarySchema = z.object({
  summary: z.string().min(1).max(2000),
  findings: z.array(z.string().min(1).max(500)).min(1).max(8),
});
