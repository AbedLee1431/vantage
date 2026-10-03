import { parseFilters, reportHistoryFilterSchema } from "@/lib/validation";
import { tenantDb } from "@/server/db/tenant";

export type ReportListItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
  finishedAt: string | null;
};

/** Report history (newest first, optional type filter, paginated). */
export async function listReports(rawFilters: unknown) {
  const { db } = await tenantDb();
  const filters = parseFilters(reportHistoryFilterSchema, rawFilters);
  const where = filters.type ? { type: filters.type } : {};
  const [total, items] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    items: items.map((r): ReportListItem => ({
      id: r.id,
      type: r.type,
      title: r.title,
      status: r.status,
      provider: r.provider,
      model: r.model,
      createdAt: r.createdAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

/** Target pickers for the report creation form (id + name only). */
export async function getReportTargets() {
  const { db } = await tenantDb();
  const [stores, products, advertisers] = await Promise.all([
    db.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.advertiser.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, platform: true },
    }),
  ]);
  return { stores, products, advertisers };
}

export type ReportDetail = {
  id: string;
  type: string;
  title: string;
  status: string;
  provider: string | null;
  model: string | null;
  provenance: string;
  summary: string;
  findings: string[];
  sections: {
    key: string;
    kind: string;
    title: string;
    stats?: { label: string; value: string }[];
    columns?: string[];
    rows?: string[][];
    items?: string[];
    text?: string;
    provenance?: string;
    note?: string;
  }[];
  evidence: { type: string; id: string; label: string }[];
  disclaimers: string[];
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

/** Single report snapshot (null when missing or foreign). Sections pass through as stored. */
export async function getReport(id: string): Promise<ReportDetail | null> {
  const { db } = await tenantDb();
  const row = await db.report.findUnique({ where: { id } });
  if (!row) return null;
  const snapshot = (row.sections ?? {}) as {
    summary?: unknown;
    findings?: unknown;
    disclaimers?: unknown;
    sections?: ReportDetail["sections"];
  };
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    provider: row.provider,
    model: row.model,
    provenance: row.provenance,
    summary: typeof snapshot.summary === "string" ? snapshot.summary : "",
    findings: Array.isArray(snapshot.findings)
      ? snapshot.findings.filter((f): f is string => typeof f === "string")
      : [],
    disclaimers: Array.isArray(snapshot.disclaimers)
      ? snapshot.disclaimers.filter((d): d is string => typeof d === "string")
      : [],
    sections: Array.isArray(snapshot.sections) ? snapshot.sections : [],
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as ReportDetail["evidence"]).filter(
          (e) => e && typeof e.type === "string" && typeof e.id === "string",
        )
      : [],
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
