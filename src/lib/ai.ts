/**
 * AI provider abstraction types (spec §23, ADR-005). Business logic talks only
 * to `AIProvider`; switching vendors is an environment change, never a rewrite.
 * No imports from here may reach the browser with secrets (providers live server-side).
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  name?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments (passed to the model). */
  parameters: Record<string, unknown>;
};

export type ToolCallRecord = {
  tool: string;
  args: unknown;
  /** Truncated result snapshot for audit (full rows stay in the DB). */
  result: unknown;
};

export type EvidenceRef = {
  type: "product" | "store" | "advertiser" | "ad" | "review" | "competitor";
  id: string;
  label: string;
};

/** One labeled block: facts first, interpretation last, always. */
export type AnalysisSection = {
  key: string;
  title: string;
  observed: string[];
  calculated: string[];
  interpretation: string;
  assumption?: string;
  needsValidation?: string;
  confidence: "low" | "medium" | "high";
};

export type MarketingAngle =
  | "price"
  | "convenience"
  | "transformation"
  | "problem-solution"
  | "social-proof"
  | "urgency"
  | "comparison"
  | "demonstration"
  | "unclear";

export type AdAnalysisResult = {
  sections: AnalysisSection[];
  angle: MarketingAngle;
  angleEvidence: string[];
  disclaimers: string[];
};

export type CompetitorAnalysisResult = {
  sections: AnalysisSection[];
  disclaimers: string[];
};

export type AIChatRequest = {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  callTool: (name: string, args: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  maxRounds?: number;
};

export type AIChatResult = {
  text: string;
  toolCalls: ToolCallRecord[];
  /** Structured evidence refs (Demo populates; live relies on tool-call audit). */
  refs?: EvidenceRef[];
};

export type AIAnalyzeRequest = {
  system: string;
  user: string;
  /** Structured evidence snapshot (Demo builds from this; handlers validate against it). */
  evidence?: unknown;
  signal?: AbortSignal;
};

export type AIAnalyzeResult = {
  text: string;
  json: unknown;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  chat(request: AIChatRequest): Promise<AIChatResult>;
  analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResult>;
}

export type ProviderStatus =
  | { active: "demo"; provider: "demo"; model: string; message: string }
  | { active: "live"; provider: string; model: string; message: string }
  | { active: "misconfigured"; message: string };

const EVIDENCE_TYPES = ["product", "store", "advertiser", "ad", "review", "competitor"] as const;

/** Coerce stored JSON to verified EvidenceRefs (drops malformed entries). */
export function toEvidenceRefs(value: unknown): EvidenceRef[] {
  if (!Array.isArray(value)) return [];
  const out: EvidenceRef[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      "type" in entry &&
      "id" in entry &&
      "label" in entry &&
      typeof (entry as { type: unknown }).type === "string" &&
      (EVIDENCE_TYPES as readonly string[]).includes((entry as { type: string }).type) &&
      typeof (entry as { id: unknown }).id === "string" &&
      typeof (entry as { label: unknown }).label === "string"
    ) {
      out.push({
        type: (entry as { type: EvidenceRef["type"] }).type,
        id: (entry as { id: string }).id,
        label: (entry as { label: string }).label,
      });
    }
  }
  return out;
}
