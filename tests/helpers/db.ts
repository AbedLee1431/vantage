import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/client";
import { hashPassword } from "@/server/password";

/**
 * Test factories. Each test creates its own org/user with unique keys so test
 * FILES can run in parallel without colliding. Callers clean up via deleteTestOrg.
 */

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export async function createTestOrg(name?: string) {
  const tag = unique("t");
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      name: "Test User",
      passwordHash: await hashPassword("TestPassword123!"),
    },
  });
  const organization = await prisma.organization.create({
    data: { name: name ?? `Test Org ${tag}`, slug: `org-${tag}` },
  });
  const membership = await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "owner" },
  });
  return { user, organization, membership };
}

/** Delete an org (cascades all tenant data + memberships) and its users. */
export async function deleteTestOrg(organizationId: string, userIds: (string | undefined)[] = []) {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  const ids = userIds.filter((id): id is string => typeof id === "string");
  if (ids.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}
