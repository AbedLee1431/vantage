import { tenantDb } from "@/server/db/tenant";
import type { Provenance } from "@/generated/client";

export type OpportunityDTO = {
  id: string;
  title: string;
  description: string;
  evidence: { type: string; id: string; label: string }[];
  supportingData: Record<string, unknown>;
  competitors: { id: string; name: string }[];
  painPoints: { theme: string; count: number }[];
  differentiation: string;
  confidence: "low" | "medium" | "high";
  status: "open" | "archived";
  provider: string;
  model: string;
  provenance: Provenance;
  createdAt: string;
};

function toDTO(row: {
  id: string;
  title: string;
  description: string;
  evidence: unknown;
  supportingData: unknown;
  competitors: unknown;
  painPoints: unknown;
  differentiation: string;
  confidence: "low" | "medium" | "high";
  status: "open" | "archived";
  provider: string;
  model: string;
  provenance: Provenance;
  createdAt: Date;
}): OpportunityDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    evidence: Array.isArray(row.evidence) ? (row.evidence as OpportunityDTO["evidence"]) : [],
    supportingData:
      row.supportingData && typeof row.supportingData === "object"
        ? (row.supportingData as Record<string, unknown>)
        : {},
    competitors: Array.isArray(row.competitors)
      ? (row.competitors as OpportunityDTO["competitors"])
      : [],
    painPoints: Array.isArray(row.painPoints)
      ? (row.painPoints as OpportunityDTO["painPoints"])
      : [],
    differentiation: row.differentiation,
    confidence: row.confidence,
    status: row.status,
    provider: row.provider,
    model: row.model,
    provenance: row.provenance,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Open opportunities first, then archived; newest first within each. */
export async function listOpportunities(): Promise<OpportunityDTO[]> {
  const { db } = await tenantDb();
  const rows = await db.opportunity.findMany({
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

export async function getOpportunity(id: string): Promise<OpportunityDTO | null> {
  const { db } = await tenantDb();
  const row = await db.opportunity.findUnique({ where: { id } });
  if (!row) return null;
  return toDTO(row);
}
