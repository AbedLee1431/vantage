import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/password";

describe("password hashing (Argon2id)", () => {
  it("hashes and verifies; wrong passwords fail; hashes are never plaintext", async () => {
    const password = "correct-horse-123";
    const hashed = await hashPassword(password);
    expect(hashed).not.toBe(password);
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hashed, password)).toBe(true);
    expect(await verifyPassword(hashed, "wrong-password")).toBe(false);
  });

  it("verify returns false (not throw) for malformed hashes", async () => {
    expect(await verifyPassword("not-a-hash", "whatever")).toBe(false);
  });
});
