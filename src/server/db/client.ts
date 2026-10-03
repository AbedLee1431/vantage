import { PrismaClient } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Base (unscoped) Prisma client. Importing this file outside `src/server/db`
 * is a lint error (R2) — application code must use the tenant-scoped client
 * from `./tenant`, which enforces organizationId on every query.
 */

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
