import { describe, expect, it } from "vitest";
import {
  canonicalFoodKey,
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

  it("parses trailing quantity and auto-assigns шт", () => {
    expect(parseLoosePantryText("огірки 4")).toEqual([
      { name: "огірки", qty: 4, unit: "шт", notes: null },
    ]);
    expect(parseLoosePantryText("яйця 3 шт")).toEqual([
      { name: "яйця", qty: 3, unit: "шт", notes: null },
    ]);
  });
});

describe("canonicalFoodKey", () => {
  it("maps plural/genitive forms to canonical", () => {
    expect(canonicalFoodKey("огірки")).toBe("огірок");
    expect(canonicalFoodKey("огірків")).toBe("огірок");
    expect(canonicalFoodKey("помідори")).toBe("помідор");
    expect(canonicalFoodKey("яйця")).toBe("яйце");
  });

  it("passes through unknown single words", () => {
    expect(canonicalFoodKey("кіноа")).toBe("кіноа");
  });
});
