import { NextRequest } from "next/server";
import { apiContext, apiError, isResponse } from "@/server/api";
import { createTenantClient } from "@/server/db/tenant";

/** RFC 4180 field escaping (quotes, commas, newlines). */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV export for one tabular report section, serialized from the STORED snapshot
 * (frozen at generation — matches what the web view shows, never live data).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;
  const { id } = await params;

  const key = req.nextUrl.searchParams.get("section");
  if (!key) return apiError("validation", "Query param section is required.", 400);

  const db = createTenantClient(ctx.organizationId);
  const report = await db.report.findUnique({ where: { id } });
  if (!report) return apiError("not_found", "Report not found.", 404);
  if (report.status !== "done") {
    return apiError("conflict", "Report is not ready yet.", 409);
  }

  const snapshot = (report.sections ?? {}) as {
    sections?: { key?: unknown; kind?: unknown; columns?: unknown; rows?: unknown }[];
  };
  const section = Array.isArray(snapshot.sections)
    ? snapshot.sections.find((s) => s?.key === key)
    : undefined;
  if (!section || section.kind !== "table") {
    return apiError("validation", "Section is missing or not tabular.", 400);
  }
  if (!Array.isArray(section.columns) || !Array.isArray(section.rows)) {
    return apiError("validation", "Section has no tabular data.", 400);
  }

  const lines = [
    (section.columns as unknown[]).map((c) => escapeField(String(c))).join(","),
    ...(section.rows as unknown[][]).map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => escapeField(String(cell ?? ""))).join(","),
    ),
  ];
  const csv = lines.join("\r\n") + "\r\n";
  const safeKey = key.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40) || "section";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${id.slice(0, 8)}-${safeKey}.csv"`,
    },
  });
}
