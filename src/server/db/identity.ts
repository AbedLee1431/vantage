import { randomBytes } from "node:crypto";
import type { Organization, PasswordResetToken, User } from "@/generated/client";
import { prisma } from "./client";

/**
 * Identity data access (User / Organization / Membership / PasswordResetToken).
 * These models are NOT tenant-scoped (no organizationId filter applies), so they
 * use the base client — but only through these focused, reviewable functions.
 * This keeps the R2 import ban absolute: application code never imports the base
 * client directly, for tenant OR identity models.
 */

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function provisionAccount(input: {
  userName: string;
  email: string;
  passwordHash: string;
  orgName: string;
}): Promise<{ user: User; organization: Organization }> {
  // Random slug suffix makes collisions negligible; retry loudly on conflict.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, name: input.userName, passwordHash: input.passwordHash },
        });
        const organization = await tx.organization.create({
          data: { name: input.orgName, slug: slugify(input.orgName) },
        });
        await tx.membership.create({
          data: { userId: user.id, organizationId: organization.id, role: "owner" },
        });
        return { user, organization };
      });
    } catch (error) {
      lastError = error;
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }
  throw lastError;
}

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<PasswordResetToken> {
  return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
}

export async function findPasswordResetToken(
  tokenHash: string,
): Promise<PasswordResetToken | null> {
  return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
}

export async function resetUserPassword(
  tokenId: string,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } }),
  ]);
}

export async function updateUserName(userId: string, name: string): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data: { name } });
}

export async function renameOrganization(
  organizationId: string,
  name: string,
): Promise<Organization> {
  return prisma.organization.update({ where: { id: organizationId }, data: { name } });
}
