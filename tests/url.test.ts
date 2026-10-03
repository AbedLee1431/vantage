import { describe, it, expect } from "vitest";
import { withSearchParams } from "@/lib/url";

describe("withSearchParams (pagination/sort links preserve filters)", () => {
  it("overrides keys while preserving the rest", () => {
    expect(
      withSearchParams("/products", { q: "jacket", category: "Jackets", page: "2" }, { page: 3 }),
    ).toBe("/products?q=jacket&category=Jackets&page=3");
  });

  it("drops keys set to undefined and ignores empties", () => {
    expect(withSearchParams("/products", { q: "", sort: "name" }, { sort: undefined })).toBe(
      "/products",
    );
  });

  it("builds a bare path when nothing remains", () => {
    expect(withSearchParams("/stores", {}, {})).toBe("/stores");
  });
});
