import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  profileSchema,
  organizationSchema,
  toFieldErrors,
  productFilterSchema,
  storeFilterSchema,
  searchSchema,
  parseFilters,
  createWatchlistSchema,
  toggleSaveSchema,
  adFilterSchema,
} from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts a valid registration", () => {
    const result = registerSchema.safeParse({
      name: "Maya",
      email: "Maya@Example.com ",
      password: "correct-horse-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // email is normalized for storage/lookup
      expect(result.data.email).toBe("maya@example.com");
    }
  });

  it("rejects bad registration input with field errors", () => {
    const result = registerSchema.safeParse({ name: "", email: "not-an-email", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = toFieldErrors(result.error);
      expect(Object.keys(fields).sort()).toEqual(["email", "name", "password"]);
    }
  });

  it("rejects short passwords but allows long ones", () => {
    expect(
      registerSchema.safeParse({ name: "A", email: "a@b.co", password: "x".repeat(11) }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: "A", email: "a@b.co", password: "x".repeat(12) }).success,
    ).toBe(true);
  });

  it("login requires a password but does not enforce its shape", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "anything" }).success).toBe(true);
  });

  it("forgot/reset/profile/org schemas behave", () => {
    expect(forgotPasswordSchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "", password: "x".repeat(12) }).success).toBe(
      false,
    );
    expect(resetPasswordSchema.safeParse({ token: "t", password: "x".repeat(12) }).success).toBe(
      true,
    );
    expect(profileSchema.safeParse({ name: "" }).success).toBe(false);
    expect(organizationSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
});

describe("discovery filters (lenient reads, strict writes)", () => {
  it("parses product filters with defaults and allow-listed sorts", () => {
    const parsed = parseFilters(productFilterSchema, {
      q: "jacket",
      category: "Jackets",
      minPrice: "10",
      sort: "price-asc",
      page: "2",
    });
    expect(parsed).toMatchObject({
      q: "jacket",
      category: "Jackets",
      minPrice: 10,
      sort: "price-asc",
      page: 2,
      pageSize: 20,
    });
  });

  it("falls back to safe defaults on hostile filter input", () => {
    const parsed = parseFilters(productFilterSchema, {
      sort: "drop-table",
      page: -5,
      pageSize: 99999,
      minPrice: "not-a-number",
    });
    expect(parsed.sort).toBe("newest");
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.minPrice).toBeUndefined();
  });

  it("parses store filters", () => {
    const parsed = parseFilters(storeFilterSchema, { country: "GB", sort: "products" });
    expect(parsed.country).toBe("GB");
    expect(parsed.sort).toBe("products");
  });

  it("search requires a non-empty query", () => {
    expect(searchSchema.safeParse({ q: "" }).success).toBe(false);
    expect(searchSchema.safeParse({ q: "  " }).success).toBe(false);
    expect(searchSchema.safeParse({ q: "jacket" }).success).toBe(true);
  });

  it("watchlist mutations validate strictly", () => {
    expect(createWatchlistSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createWatchlistSchema.safeParse({ name: "My list" }).success).toBe(true);
    expect(toggleSaveSchema.safeParse({ itemType: "spaceship", refId: "" }).success).toBe(false);
    expect(toggleSaveSchema.safeParse({ itemType: "product", refId: "abc" }).success).toBe(true);
  });
});

describe("ad filters (lenient reads)", () => {
  it("parses the full filter set with defaults", () => {
    const parsed = parseFilters(adFilterSchema, {
      q: "jacket",
      platform: "Meta",
      format: "video",
      minDuration: "7",
      sort: "longest",
    });
    expect(parsed).toMatchObject({
      q: "jacket",
      platform: "Meta",
      format: "video",
      minDuration: 7,
      sort: "longest",
      page: 1,
      pageSize: 20,
    });
  });

  it("falls back safely on hostile ad input", () => {
    const parsed = parseFilters(adFilterSchema, {
      sort: "evil",
      page: 0,
      minDuration: -3,
      from: "not-a-date",
    });
    expect(parsed.sort).toBe("newest");
    expect(parsed.page).toBe(1);
    expect(parsed.minDuration).toBeUndefined();
    expect(parsed.from).toBeUndefined();
  });

  it("accepts well-formed date bounds", () => {
    const parsed = parseFilters(adFilterSchema, { from: "2026-01-01", to: "2026-09-30" });
    expect(parsed.from).toBe("2026-01-01");
    expect(parsed.to).toBe("2026-09-30");
  });
});
