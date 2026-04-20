import { describe, it, expect } from "vitest";
import {
  stableId,
  normalizeOFFProduct,
  normalizeUSDAProduct,
} from "./food-search.js";

describe("stableId", () => {
  it("is deterministic across calls with identical input", () => {
    const a = stableId("off", ["Молоко", "Галичина"]);
    const b = stableId("off", ["Молоко", "Галичина"]);
    expect(a).toBe(b);
    expect(a.startsWith("off_")).toBe(true);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(stableId("usda", ["  Apple  ", null])).toBe(
      stableId("usda", ["apple", undefined]),
    );
  });

  it("differentiates inputs that only differ by order", () => {
    expect(stableId("off", ["a", "b"])).not.toBe(stableId("off", ["b", "a"]));
  });

  it("returns a short, url-safe suffix", () => {
    const id = stableId("off", ["Name", "Brand"]);
    expect(id).toMatch(/^off_[0-9a-z]+$/);
  });
});

describe("normalizeOFFProduct", () => {
  const nutriments = {
    "energy-kcal_100g": 250,
    proteins_100g: 3.2,
    fat_100g: 1.1,
    carbohydrates_100g: 52,
  };

  it("uses the OFF `code` (barcode) as the id when present", () => {
    const result = normalizeOFFProduct({
      code: "3017620422003",
      product_name: "Nutella",
      brands: "Ferrero",
      nutriments,
    });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("off_3017620422003");
  });

  it("strips leading zeros from numeric codes but keeps a single 0", () => {
    expect(
      normalizeOFFProduct({
        code: "000012345",
        product_name: "Something",
        nutriments,
      })!.id,
    ).toBe("off_12345");
    expect(
      normalizeOFFProduct({
        code: "0000",
        product_name: "Zeroed",
        nutriments,
      })!.id,
    ).toBe("off_0");
  });

  it("falls back to a deterministic stable id when `code` is missing", () => {
    // Regression for the unstable-id bug: two calls with the same payload
    // and no `code` must produce the same id (previously was a Date.now()
    // suffix and churned across requests).
    const payload = {
      product_name_uk: "Молоко",
      brands: "Галичина",
      nutriments,
    };
    const a = normalizeOFFProduct(payload);
    const b = normalizeOFFProduct(payload);
    expect(a!.id).toBe(b!.id);
    expect(a!.id).toMatch(/^off_[0-9a-z]+$/);
  });

  it("prefers the Ukrainian localized name when provided", () => {
    const p = normalizeOFFProduct({
      product_name: "Milk",
      product_name_uk: "Молоко",
      nutriments,
    });
    expect(p!.name).toBe("Молоко");
  });

  it("accepts Latin product_name containing digits and punctuation", () => {
    // The simplified regex relies on \u0020-\u024F covering ASCII digits and
    // common punctuation. Make sure that's actually true at runtime.
    const p = normalizeOFFProduct({
      product_name: "Greek Yogurt 2.5% (500 g)",
      nutriments,
    });
    expect(p?.name).toBe("Greek Yogurt 2.5% (500 g)");
  });

  it("rejects product_name with control characters / disallowed ranges", () => {
    const p = normalizeOFFProduct({
      product_name: "bad\u0000name",
      nutriments,
    });
    expect(p).toBeNull();
  });

  it("returns null when every macro is missing", () => {
    const p = normalizeOFFProduct({
      product_name: "Mystery",
      nutriments: {},
    });
    expect(p).toBeNull();
  });

  it("rounds macros to 1 decimal place and fills missing values with 0", () => {
    const p = normalizeOFFProduct({
      product_name: "X",
      nutriments: { "energy-kcal_100g": 99.87 },
    });
    expect(p!.per100.kcal).toBe(99.9);
    expect(p!.per100.protein_g).toBe(0);
  });

  it("takes only the first brand from a comma-separated list", () => {
    const p = normalizeOFFProduct({
      product_name: "X",
      brands: "Alpha, Beta, Gamma",
      nutriments,
    });
    expect(p!.brand).toBe("Alpha");
  });

  it("defaults defaultGrams to 100 when serving_quantity is absent", () => {
    expect(
      normalizeOFFProduct({
        product_name: "X",
        nutriments,
      })!.defaultGrams,
    ).toBe(100);
  });
});

describe("normalizeUSDAProduct", () => {
  const nutrients = [
    { nutrientId: 1008, value: 64 },
    { nutrientId: 1003, value: 3.4 },
    { nutrientId: 1004, value: 3.6 },
    { nutrientId: 1005, value: 4.8 },
  ];

  it("uses fdcId as the id when present", () => {
    const p = normalizeUSDAProduct({
      fdcId: 170290,
      description: "Milk, whole",
      foodNutrients: nutrients,
    });
    expect(p!.id).toBe("usda_170290");
  });

  it("falls back to a deterministic id when fdcId is missing", () => {
    const payload = { description: "Custom food", foodNutrients: nutrients };
    expect(normalizeUSDAProduct(payload)!.id).toBe(
      normalizeUSDAProduct(payload)!.id,
    );
  });

  it("returns null when description is empty", () => {
    expect(
      normalizeUSDAProduct({ description: "", foodNutrients: nutrients }),
    ).toBeNull();
  });

  it("returns null when every nutrient is missing", () => {
    expect(
      normalizeUSDAProduct({ description: "X", foodNutrients: [] }),
    ).toBeNull();
  });

  it("maps the four tracked nutrient ids (1008/1003/1004/1005)", () => {
    const p = normalizeUSDAProduct({
      fdcId: 1,
      description: "X",
      foodNutrients: nutrients,
    });
    expect(p!.per100).toEqual({
      kcal: 64,
      protein_g: 3.4,
      fat_g: 3.6,
      carbs_g: 4.8,
    });
  });
});
