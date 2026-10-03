import { createHash } from "node:crypto";
import { findPasswordResetToken } from "@/server/db/identity";

/** Validity check for a password-reset token (does not consume it). */
export async function getResetTokenStatus(token: string): Promise<{ valid: boolean }> {
  if (!token) return { valid: false };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await findPasswordResetToken(tokenHash);
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return { valid: false };
  }
  return { valid: true };
}
