import { describe, expect, it } from "vitest";
import {
  normalizeFoodName,
  normalizeUnit,
  parseLoosePantryText,
} from "./pantryTextParser.js";

describe("normalizeFoodName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeFoodName("  курка   філе ")).toBe("курка філе");
  });
});

describe("normalizeUnit", () => {
  it("normalizes common units", () => {
    expect(normalizeUnit("гр")).toBe("г");
    expect(normalizeUnit("кг")).toBe("кг");
    expect(normalizeUnit("л")).toBe("л");
    expect(normalizeUnit("шт")).toBe("шт");
  });
});

describe("parseLoosePantryText", () => {
  it("parses qty+unit+name", () => {
    expect(parseLoosePantryText("2 яйця")).toEqual([
      { name: "яйця", qty: 2, unit: "шт", notes: null },
    ]);
    expect(parseLoosePantryText("200 г курка")).toEqual([
      { name: "курка", qty: 200, unit: "г", notes: null },
    ]);
    expect(parseLoosePantryText("0.5л молоко")).toEqual([
      { name: "молоко", qty: 0.5, unit: "л", notes: null },
    ]);
  });

  it("splits by commas/semicolons and newlines", () => {
    const items = parseLoosePantryText("яйця, рис;\nогірок");
    expect(items.map((x) => x.name)).toEqual(["яйця", "рис", "огірок"]);
  });
});
