import { tenantDb } from "@/server/db/tenant";
import { getAiUsage as usageFor } from "@/server/ai/usage";

/**
 * AI module queries (history, single results, conversations, usage).
 * All tenant-scoped; Dates serialized to ISO strings for client safety.
 */

function iso(d: Date): string {
  return d.toISOString();
}

export async function listAnalyses(kind?: "ad" | "competitor", targetRef?: string) {
  const { db } = await tenantDb();
  const rows = await db.aiAnalysis.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(targetRef ? { targetRef } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Resolve target display names in bulk.
  const adIds = [...new Set(rows.filter((r) => r.kind === "ad").map((r) => r.targetRef))];
  const storeIds = [
    ...new Set(rows.filter((r) => r.kind === "competitor").map((r) => r.targetRef)),
  ];
  const [ads, stores] = await Promise.all([
    adIds.length
      ? db.ad.findMany({ where: { id: { in: adIds } }, select: { id: true, title: true } })
      : [],
    storeIds.length
      ? db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const adNames = new Map(ads.map((a) => [a.id, a.title]));
  const storeNames = new Map(stores.map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    targetRef: r.targetRef,
    targetName:
      r.kind === "ad"
        ? (adNames.get(r.targetRef) ?? "Unknown ad")
        : (storeNames.get(r.targetRef) ?? "Unknown store"),
    provider: r.provider,
    model: r.model,
    provenance: r.provenance,
    createdAt: iso(r.createdAt),
  }));
}

export async function getAnalysis(id: string) {
  const { db } = await tenantDb();
  const row = await db.aiAnalysis.findUnique({ where: { id } });
  if (!row) return null;

  let targetName = "Unknown";
  if (row.kind === "ad") {
    const ad = await db.ad.findUnique({ where: { id: row.targetRef }, select: { title: true } });
    if (ad) targetName = ad.title;
  } else {
    const store = await db.store.findUnique({
      where: { id: row.targetRef },
      select: { name: true },
    });
    if (store) targetName = store.name;
  }

  return {
    id: row.id,
    kind: row.kind,
    targetRef: row.targetRef,
    targetName,
    provider: row.provider,
    model: row.model,
    provenance: row.provenance,
    result: row.result,
    evidence: row.evidence,
    createdAt: iso(row.createdAt),
  };
}

export async function listConversations() {
  const { db } = await tenantDb();
  const rows = await db.aiConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { _count: { select: { messages: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    messageCount: c._count.messages,
    updatedAt: iso(c.updatedAt),
  }));
}

export async function getConversation(id: string) {
  const { db } = await tenantDb();
  const row = await db.aiConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    messages: row.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      evidence: m.evidence,
      provenance: m.provenance,
      createdAt: iso(m.createdAt),
    })),
  };
}

export async function getAiUsage() {
  const { organizationId } = await tenantDb();
  return usageFor(organizationId);
}
