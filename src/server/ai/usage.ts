import { createTenantClient } from "../db/tenant";

/**
 * AI usage tracking (Phase 4: informational only). Counts derive from persisted
 * rows — no UsageRecord table until billing enforces limits (Phase 8).
 */

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getAiUsage(organizationId: string) {
  const db = createTenantClient(organizationId);
  const since = monthStart(new Date());
  const [analyses, messages] = await Promise.all([
    db.aiAnalysis.count({ where: { createdAt: { gte: since } } }),
    db.aiMessage.count({ where: { createdAt: { gte: since } } }),
  ]);
  return {
    analysesThisMonth: analyses,
    chatMessagesThisMonth: messages,
    monthStart: since,
    note: "Informational. Plan limits arrive with billing (Phase 8).",
  };
}
