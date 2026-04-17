import { describe, expect, it } from "vitest";
import { mergeItems } from "./mergeItems.js";

describe("mergeItems", () => {
  it("adds new distinct items", () => {
    const out = mergeItems(
      [{ name: "яйця", qty: null, unit: null }],
      [{ name: "рис" }],
    );
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
    const out = mergeItems(
      [],
      [
        { name: "курка", qty: 200, unit: "г" },
        { name: "курка", qty: 200, unit: "г" },
      ],
    );
    expect(out).toHaveLength(1);
  });

  it("does not duplicate when incoming has same name but no qty/unit and existing has qty/unit", () => {
    const out = mergeItems(
      [{ name: "огірок", qty: 4, unit: "шт", notes: null }],
      [{ name: "огірок", qty: null, unit: null, notes: null }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ qty: 5, unit: "шт" });
  });

  it("upgrades existing entry without qty/unit when incoming has qty/unit", () => {
    const out = mergeItems(
      [{ name: "огірок", qty: null, unit: null, notes: null }],
      [{ name: "огірок", qty: 4, unit: "шт", notes: null }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ qty: 4, unit: "шт" });
  });

  it("merges AI duplicates: same name with and without qty/unit into one entry", () => {
    const out = mergeItems(
      [],
      [
        { name: "огірок", qty: null, unit: null, notes: null },
        { name: "огірок", qty: 4, unit: "шт", notes: null },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ qty: 5, unit: "шт" });
  });

  it("same product with incompatible units (г vs уп): second entry is skipped by dedup policy", () => {
    const out = mergeItems(
      [{ name: "огірок", qty: 200, unit: "г", notes: null }],
      [{ name: "огірок", qty: 1, unit: "уп", notes: null }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ qty: 200, unit: "г" });
  });
});
