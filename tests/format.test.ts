import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatDurationDays, timeAgo } from "@/lib/format";

describe("format helpers", () => {
  it("formats money with currency, never float artifacts", () => {
    expect(formatCurrency(189, "USD")).toBe("$189.00");
    expect(formatCurrency("42.5", "USD")).toBe("$42.50");
    expect(formatCurrency(Number.NaN)).toBe("—");
  });

  it("formats dates absolutely", () => {
    expect(formatDate(new Date("2026-03-02T12:00:00Z"))).toBe("Mar 2, 2026");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("renders relative time deterministically", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(timeAgo(new Date("2026-09-30T11:59:30Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-09-30T11:00:00Z"), now)).toBe("1h ago");
    expect(timeAgo(new Date("2026-09-27T12:00:00Z"), now)).toBe("3d ago");
    expect(timeAgo("garbage", now)).toBe("—");
  });

  it("formats whole-day durations", () => {
    expect(formatDurationDays(0)).toBe("Less than a day");
    expect(formatDurationDays(1)).toBe("1 day");
    expect(formatDurationDays(21)).toBe("21 days");
    expect(formatDurationDays(-1)).toBe("—");
  });
});
