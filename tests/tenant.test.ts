import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/server/db/client";
import { createTenantClient } from "@/server/db/tenant";
import { NotFoundError } from "@/server/errors";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

// tenant.ts imports @/server/auth for requireUser/requireOrg, which this file never
// calls — stub it so the real next-auth package is not loaded (vitest ESM friction).
vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

describe("tenant isolation (server-side, extension-enforced)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userIds: string[];
  let storeAId: string;
  let storeBId: string;

  beforeAll(async () => {
    const a = await createTestOrg("Tenant A");
    const b = await createTestOrg("Tenant B");
    orgA = a.organization;
    orgB = b.organization;
    userIds = [a.user.id, b.user.id];

    const dbA = createTenantClient(orgA.id);
    const dbB = createTenantClient(orgB.id);
    const sA = await dbA.store.create({
      data: {
        organizationId: orgA.id,
        name: "Store A",
        domain: "a.example",
        category: "Cat",
        country: "US",
        platform: "Shopify",
        provenance: "demo",
      },
    });
    const sB = await dbB.store.create({
      data: {
        organizationId: orgB.id,
        name: "Store B",
        domain: "b.example",
        category: "Cat",
        country: "US",
        platform: "Shopify",
        provenance: "demo",
      },
    });
    storeAId = sA.id;
    storeBId = sB.id;
  });

  afterAll(async () => {
    await deleteTestOrg(orgA.id, [userIds[0]]);
    await deleteTestOrg(orgB.id, [userIds[1]]);
  });

  it("findMany only returns the caller's organization rows", async () => {
    const dbA = createTenantClient(orgA.id);
    const rows = await dbA.store.findMany();
    expect(rows.map((r) => r.id)).toEqual([storeAId]);
  });

  it("findFirst/findUnique do not leak across organizations", async () => {
    const dbA = createTenantClient(orgA.id);
    expect(await dbA.store.findFirst({ where: { id: storeBId } })).toBeNull();
    // findUnique is rewritten to scoped findFirst (ids are globally unique PKs)
    expect(await dbA.store.findUnique({ where: { id: storeBId } })).toBeNull();
    expect(await dbA.store.findUnique({ where: { id: storeAId } })).not.toBeNull();
    await expect(dbA.store.findUniqueOrThrow({ where: { id: storeBId } })).rejects.toThrow();
  });

  it("cross-organization update/delete throw NotFound (no existence leak)", async () => {
    const dbA = createTenantClient(orgA.id);
    await expect(
      dbA.store.update({ where: { id: storeBId }, data: { name: "Hacked" } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(dbA.store.delete({ where: { id: storeBId } })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    // B's row is untouched
    const stillThere = await prisma.store.findUnique({ where: { id: storeBId } });
    expect(stillThere?.name).toBe("Store B");
  });

  it("unscoped deleteMany only deletes the caller's rows", async () => {
    const dbA = createTenantClient(orgA.id);
    const result = await dbA.store.deleteMany({});
    expect(result.count).toBe(1);
    expect(await prisma.store.findUnique({ where: { id: storeBId } })).not.toBeNull();
    // restore A's row for the remaining assertions
    const restored = await dbA.store.create({
      data: {
        organizationId: orgA.id,
        name: "Store A",
        domain: "a.example",
        category: "Cat",
        country: "US",
        platform: "Shopify",
        provenance: "demo",
      },
    });
    storeAId = restored.id;
  });

  it("create injects organizationId at runtime even if omitted (safety net)", async () => {
    const dbA = createTenantClient(orgA.id);
    // Bypass TypeScript (which already requires organizationId) to prove the runtime net.
    const created = await dbA.store.create({
      data: {
        name: "Net",
        domain: "net.example",
        category: "C",
        country: "US",
        platform: "X",
        provenance: "demo",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    expect(created.organizationId).toBe(orgA.id);
    await dbA.store.delete({ where: { id: created.id } });
  });

  it("upsert on tenant models fails loudly (never silently mis-scoped)", async () => {
    const dbA = createTenantClient(orgA.id);
    await expect(
      dbA.store.upsert({
        where: { id: storeAId },
        create: {
          organizationId: orgA.id,
          name: "X",
          domain: "x.example",
          category: "C",
          country: "US",
          platform: "X",
          provenance: "demo",
        },
        update: { name: "X" },
      }),
    ).rejects.toThrow(/upsert is not supported/);
  });

  it("counts are scoped", async () => {
    const dbA = createTenantClient(orgA.id);
    const dbB = createTenantClient(orgB.id);
    expect(await dbA.store.count()).toBe(1);
    expect(await dbB.store.count()).toBe(1);
  });

  it("fails closed (loudly, never leaking) for models without the discriminator", async () => {
    // Identity models bypass scoping by allowlist; anything else without the
    // column must throw a validation error, never return cross-tenant rows.
    const dbA = createTenantClient(orgA.id);
    await expect(dbA.user.findMany({ take: 1 })).rejects.toThrow();
  });
});
