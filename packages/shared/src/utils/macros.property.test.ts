import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  normalizeMacrosNullable,
  macrosToTotals,
  macrosHasAnyValue,
} from "./macros";

// T-8 (testing/devx) — property-based coverage for the macros normalizers.
// Seed is pinned so a "random failure" can never appear without a code
// change; run count is overridable via FAST_CHECK_NUM_RUNS (CI uses a
// smaller budget than local exhaustive runs).
fc.configureGlobal({
  seed: 42,
  numRuns: Number(process.env["FAST_CHECK_NUM_RUNS"]) || 200,
});

// Arbitrary "macro field" — covers the messy shapes the normalizers must
// survive: finite numbers (incl. negative), NaN/Infinity, numeric strings,
// null/undefined, and junk.
const macroFieldArb = fc.oneof(
  fc.double(),
  fc.double().map((n) => String(n)),
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
);

const macrosArb = fc.record({
  kcal: macroFieldArb,
  protein_g: macroFieldArb,
  fat_g: macroFieldArb,
  carbs_g: macroFieldArb,
});

describe("macros — property-based", () => {
  it("macrosToTotals always yields non-negative finite numbers for every field", () => {
    fc.assert(
      fc.property(macrosArb, (mac) => {
        const t = macrosToTotals(mac);
        for (const v of [t.kcal, t.protein_g, t.fat_g, t.carbs_g]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it("macrosToTotals is idempotent (totals∘totals = totals)", () => {
    fc.assert(
      fc.property(macrosArb, (mac) => {
        const once = macrosToTotals(mac);
        expect(macrosToTotals(once)).toEqual(once);
      }),
    );
  });

  it("normalizeMacrosNullable is idempotent on its own output", () => {
    fc.assert(
      fc.property(macrosArb, (mac) => {
        const once = normalizeMacrosNullable(mac);
        expect(normalizeMacrosNullable(once)).toEqual(once);
      }),
    );
  });

  it("a non-negative finite value passes through macrosToTotals unchanged", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e7, noNaN: true, noDefaultInfinity: true }),
        (n) => {
          expect(macrosToTotals({ kcal: n }).kcal).toBe(n);
        },
      ),
    );
  });

  it("an empty object has no values; a non-negative field is detected", () => {
    expect(macrosHasAnyValue({})).toBe(false);
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e7, noNaN: true, noDefaultInfinity: true }),
        (n) => {
          expect(macrosHasAnyValue({ protein_g: n })).toBe(true);
        },
      ),
    );
  });

  it("non-object inputs normalize to all-null (never throw)", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.double(), fc.constant(null), fc.boolean()),
        (junk) => {
          const m = normalizeMacrosNullable(junk);
          expect(m).toEqual({
            kcal: null,
            protein_g: null,
            fat_g: null,
            carbs_g: null,
          });
        },
      ),
    );
  });
});
