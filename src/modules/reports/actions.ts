"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tenantDb } from "@/server/db/tenant";
import { NotFoundError, UnauthorizedError } from "@/server/errors";

/** Hard-delete an owned report (snapshots regenerate on demand). */
export async function deleteReportAction(formData: FormData): Promise<void> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  try {
    ({ db } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const value = formData.get("id");
  const id = typeof value === "string" ? value : "";
  if (!id) throw new Error("Invalid request.");
  // Auto-scoped: foreign ids resolve to null, never to another org's rows.
  const row = await db.report.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Report not found.");
  await db.report.delete({ where: { id: row.id } });
  revalidatePath("/reports");
}
