"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/modules/auth/actions";
import { organizationSchema, profileSchema, toFieldErrors } from "@/lib/validation";

export type { ActionState };
import { renameOrganization, updateUserName } from "@/server/db/identity";
import { requireOrg, requireUser } from "@/server/db/tenant";
import { UnauthorizedError } from "@/server/errors";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let userId: string;
  try {
    ({ id: userId } = await requireUser());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = profileSchema.safeParse({ name: formString(formData, "name") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  await updateUserName(userId, parsed.data.name);
  revalidatePath("/settings");
  return { ok: true };
}

export async function renameOrgAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOrg());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = organizationSchema.safeParse({ name: formString(formData, "name") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  // organizationId comes from the session, never from the form — safe by construction.
  await renameOrganization(organizationId, parsed.data.name);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
