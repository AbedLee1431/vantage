import { requireOrg } from "@/server/db/tenant";

/** Account + organization for the settings page (session-derived, never client input). */
export async function getAccount() {
  const { user, organization } = await requireOrg();
  return { user, organization };
}
