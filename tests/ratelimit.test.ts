import { describe, it, expect } from "vitest";
import { prisma } from "@/server/db/client";
import { checkRateLimit } from "@/server/db/ratelimit";

describe("DB-backed rate limiting", () => {
  it("allows up to the limit, then blocks with remaining counts", async () => {
    const key = `test-${Date.now()}-allow`;
    const first = await checkRateLimit(key, 2, 60_000);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    const second = await checkRateLimit(key, 2, 60_000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    const third = await checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    await prisma.rateLimit.delete({ where: { key } });
  });

  it("resets after the window expires", async () => {
    const key = `test-${Date.now()}-expiry`;
    await checkRateLimit(key, 1, 1);
    await new Promise((r) => setTimeout(r, 10));
    const again = await checkRateLimit(key, 1, 1);
    expect(again.allowed).toBe(true);
    await prisma.rateLimit.delete({ where: { key } });
  });
});
