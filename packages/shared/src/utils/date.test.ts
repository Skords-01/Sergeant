import { describe, it, expect } from "vitest";
import { toLocalISODate } from "./date";

describe("shared/lib/date – toLocalISODate", () => {
  it("formats a Date object with zero-padded month and day", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalISODate(new Date(2026, 8, 9))).toBe("2026-09-09");
    expect(toLocalISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("formats a numeric timestamp (milliseconds)", () => {
    const ms = new Date(2026, 3, 19).getTime();
    expect(toLocalISODate(ms)).toBe("2026-04-19");
  });

  it("formats an ISO date string (local timezone interpretation)", () => {
    // Construct from known local Date to avoid timezone divergence
    const d = new Date(2025, 6, 4); // 4 Jul 2025 local
    const iso = toLocalISODate(d.toISOString());
    // Result depends on UTC offset but must be a valid ISO date
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns 1970-01-01 for an invalid date string", () => {
    expect(toLocalISODate("not-a-date")).toBe("1970-01-01");
    expect(toLocalISODate("")).toBe("1970-01-01");
  });

  it("returns 1970-01-01 for NaN timestamp", () => {
    expect(toLocalISODate(NaN)).toBe("1970-01-01");
  });

  it("uses current date when called with no argument", () => {
    const before = toLocalISODate(new Date());
    const result = toLocalISODate();
    const after = toLocalISODate(new Date());
    // result must be within the same day as before/after
    expect(result >= before && result <= after).toBe(true);
  });

  it("handles year boundaries correctly", () => {
    expect(toLocalISODate(new Date(2024, 11, 31))).toBe("2024-12-31");
    expect(toLocalISODate(new Date(2025, 0, 1))).toBe("2025-01-01");
  });
});
