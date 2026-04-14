import { describe, expect, it } from "vitest";
import { mergeItems } from "./mergeItems.js";

describe("mergeItems", () => {
  it("adds new distinct items", () => {
    const out = mergeItems([{ name: "яйця", qty: null, unit: null }], [{ name: "рис" }]);
    expect(out.map((x) => x.name)).toEqual(["яйця", "рис"]);
  });

  it("sums compatible qty+unit to base unit", () => {
    const out = mergeItems(
      [{ name: "молоко", qty: 1, unit: "л" }],
      [{ name: "молоко", qty: 500, unit: "мл" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "молоко", unit: "мл", qty: 1500 });
  });

  it("avoids exact duplicates by fingerprint", () => {
    const out = mergeItems([], [
      { name: "курка", qty: 200, unit: "г" },
      { name: "курка", qty: 200, unit: "г" },
    ]);
    expect(out).toHaveLength(1);
  });
});

