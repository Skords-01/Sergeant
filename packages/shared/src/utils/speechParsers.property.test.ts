import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { parseUaNumber, normalizeUaNumbers } from "./speechParsers";

// T-8 (testing/devx) — property-based coverage for the UA speech number
// helpers. Seed pinned; run count overridable via FAST_CHECK_NUM_RUNS.
fc.configureGlobal({
  seed: 42,
  numRuns: Number(process.env["FAST_CHECK_NUM_RUNS"]) || 200,
});

// A mix of free unicode text and the UA number-words the parser recognises,
// so runs actually exercise the number-word collapse path (not just junk).
const UA_NUMBER_WORDS = [
  "нуль",
  "один",
  "два",
  "три",
  "десять",
  "вісімдесят",
  "сто",
  "двісті",
  "тисяча",
  "п'ять",
];
const speechWordArb = fc.oneof(
  fc.constantFrom(...UA_NUMBER_WORDS),
  fc.string(),
  fc.integer({ min: 0, max: 9999 }).map(String),
);
const speechTextArb = fc
  .array(speechWordArb, { maxLength: 12 })
  .map((ws) => ws.join(" "));

describe("speechParsers — property-based", () => {
  it("normalizeUaNumbers is idempotent (normalize∘normalize = normalize)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), speechTextArb), (text) => {
        const once = normalizeUaNumbers(text);
        expect(normalizeUaNumbers(once)).toBe(once);
      }),
    );
  });

  it("normalizeUaNumbers output is whitespace-normalised (trimmed, no double spaces)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), speechTextArb), (text) => {
        const out = normalizeUaNumbers(text);
        expect(out).toBe(out.trim());
        expect(/\s\s/.test(out)).toBe(false);
      }),
    );
  });

  it("parseUaNumber returns either null or a finite number (never NaN)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), speechTextArb), (text) => {
        const n = parseUaNumber(text);
        expect(n === null || Number.isFinite(n)).toBe(true);
      }),
    );
  });

  it("parseUaNumber reads back a plain non-negative integer literal", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (n) => {
        expect(parseUaNumber(String(n))).toBe(n);
      }),
    );
  });
});
