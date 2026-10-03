"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acknowledgeAlertSchema } from "@/lib/validation";
import { tenantDb } from "@/server/db/tenant";
import { NotFoundError, UnauthorizedError } from "@/server/errors";

/** Acknowledge an alert (one-way; scoped lookup fails closed on foreign ids). */
export async function acknowledgeAlertAction(formData: FormData): Promise<void> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  try {
    ({ db } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const value = formData.get("id");
  const parsed = acknowledgeAlertSchema.safeParse({ id: typeof value === "string" ? value : "" });
  if (!parsed.success) throw new Error("Invalid request.");
  const alert = await db.alert.findUnique({ where: { id: parsed.data.id } });
  if (!alert) throw new NotFoundError("Alert not found.");
  if (!alert.acknowledgedAt) {
    await db.alert.update({ where: { id: alert.id }, data: { acknowledgedAt: new Date() } });
  }
  revalidatePath("/watchlists");
}
