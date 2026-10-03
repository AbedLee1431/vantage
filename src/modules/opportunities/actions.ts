"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { opportunityIdSchema } from "@/lib/validation";
import { tenantDb } from "@/server/db/tenant";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/server/errors";

function idFrom(formData: FormData): string {
  const value = formData.get("id");
  return typeof value === "string" ? value : "";
}

async function setStatus(formData: FormData, status: "open" | "archived"): Promise<void> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  try {
    ({ db } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = opportunityIdSchema.safeParse({ id: idFrom(formData) });
  if (!parsed.success) throw new ValidationError();
  // Auto-scoped: foreign ids resolve to null, never to another org's rows.
  const row = await db.opportunity.findUnique({ where: { id: parsed.data.id } });
  if (!row) throw new NotFoundError("Opportunity not found.");
  await db.opportunity.update({ where: { id: row.id }, data: { status } });
  revalidatePath("/opportunities");
}

export async function archiveOpportunityAction(formData: FormData): Promise<void> {
  await setStatus(formData, "archived");
}

export async function restoreOpportunityAction(formData: FormData): Promise<void> {
  await setStatus(formData, "open");
}
