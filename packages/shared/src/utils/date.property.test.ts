import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { toLocalISODate } from "./date";

// T-8 (testing/devx) — property-based coverage for toLocalISODate. Seed
// pinned; run count overridable via FAST_CHECK_NUM_RUNS.
fc.configureGlobal({
  seed: 42,
  numRuns: Number(process.env["FAST_CHECK_NUM_RUNS"]) || 200,
});

const ISO_DATE = /^-?\d{4,}-\d{2}-\d{2}$/;

describe("toLocalISODate — property-based", () => {
  it("always returns a YYYY-MM-DD shaped string for Date inputs", () => {
    fc.assert(
      fc.property(fc.date({ noInvalidDate: true }), (d) => {
        const out = toLocalISODate(d);
        expect(out).toMatch(ISO_DATE);
        // Month / day segments are always in calendar range.
        const [, mm, dd] = out.split("-").slice(-3);
        expect(Number(mm)).toBeGreaterThanOrEqual(1);
        expect(Number(mm)).toBeLessThanOrEqual(12);
        expect(Number(dd)).toBeGreaterThanOrEqual(1);
        expect(Number(dd)).toBeLessThanOrEqual(31);
      }),
    );
  });

  it("returns a valid date string for arbitrary epoch-millis numbers", () => {
    fc.assert(
      // Bound to a sane epoch range so getFullYear stays 4+ digits.
      fc.property(fc.integer({ min: 0, max: 4_102_444_800_000 }), (ms) => {
        expect(toLocalISODate(ms)).toMatch(ISO_DATE);
      }),
    );
  });

  it("never throws and falls back to 1970-01-01 on unparseable strings", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = toLocalISODate(s);
        // Either a valid parse (YYYY-MM-DD) or the documented fallback.
        expect(out === "1970-01-01" || ISO_DATE.test(out)).toBe(true);
      }),
    );
  });

  it("is stable across repeated calls on the same Date", () => {
    fc.assert(
      fc.property(fc.date({ noInvalidDate: true }), (d) => {
        expect(toLocalISODate(d)).toBe(toLocalISODate(d));
      }),
    );
  });
});
