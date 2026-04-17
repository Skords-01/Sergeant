import { beforeEach, describe, expect, it } from "vitest";
import {
  NUTRITION_ACTIVE_PANTRY_KEY,
  NUTRITION_LOG_KEY,
  NUTRITION_PANTRIES_KEY,
  loadActivePantryId,
  loadNutritionLog,
  loadPantries,
  normalizeNutritionLog,
  persistPantries,
} from "./nutritionStorage.js";
import { storageManager } from "@shared/lib/storageManager.js";

function createLocalStorageMock() {
  /** @type {Map<string, string>} */
  const store = new Map();
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => void store.set(String(k), String(v)),
    removeItem: (k) => void store.delete(String(k)),
    clear: () => void store.clear(),
    _dump: () => Object.fromEntries(store.entries()),
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

describe("loadActivePantryId", () => {
  it("returns home by default", () => {
    expect(loadActivePantryId(NUTRITION_ACTIVE_PANTRY_KEY)).toBe("home");
  });
});

describe("loadPantries", () => {
  it("loads stored pantries when present", () => {
    globalThis.localStorage.setItem(
      NUTRITION_PANTRIES_KEY,
      JSON.stringify([{ id: "home", name: "Дім", items: [], text: "x" }]),
    );
    const pantries = loadPantries(
      NUTRITION_PANTRIES_KEY,
      NUTRITION_ACTIVE_PANTRY_KEY,
    );
    expect(pantries).toHaveLength(1);
    expect(pantries[0].text).toBe("x");
  });

  it("migrates from legacy keys when new key missing", () => {
    globalThis.localStorage.setItem(
      "nutrition_pantry_items_v0",
      JSON.stringify([{ name: "яйця", qty: 2, unit: "шт", notes: null }]),
    );
    globalThis.localStorage.setItem("nutrition_pantry_text_v0", "яйця");
    storageManager.resetMigration("nutrition_001_migrate_legacy_pantry");
    storageManager.runAll();
    const pantries = loadPantries(
      NUTRITION_PANTRIES_KEY,
      NUTRITION_ACTIVE_PANTRY_KEY,
    );
    expect(pantries).toHaveLength(1);
    expect(pantries[0].items).toHaveLength(1);
    expect(pantries[0].text).toBe("яйця");
    expect(globalThis.localStorage.getItem(NUTRITION_ACTIVE_PANTRY_KEY)).toBe(
      "home",
    );
  });
});

describe("persistPantries", () => {
  it("persists pantries and active id", () => {
    persistPantries(
      NUTRITION_PANTRIES_KEY,
      NUTRITION_ACTIVE_PANTRY_KEY,
      [{ id: "a", name: "A", items: [], text: "" }],
      "a",
    );
    const raw = globalThis.localStorage.getItem(NUTRITION_PANTRIES_KEY);
    expect(JSON.parse(raw)).toHaveLength(1);
    expect(globalThis.localStorage.getItem(NUTRITION_ACTIVE_PANTRY_KEY)).toBe(
      "a",
    );
  });
});

describe("normalizeNutritionLog", () => {
  it("infers mealType from Ukrainian label", () => {
    const raw = {
      "2026-01-01": {
        meals: [{ id: "x", name: "Суп", label: "Обід", macros: { kcal: 100 } }],
      },
    };
    const out = normalizeNutritionLog(raw);
    expect(out["2026-01-01"].meals[0].mealType).toBe("lunch");
    expect(out["2026-01-01"].meals[0].macros.kcal).toBe(100);
  });

  it("keeps mealType when valid", () => {
    const out = normalizeNutritionLog({
      "2026-02-02": {
        meals: [
          {
            id: "a",
            name: "x",
            mealType: "dinner",
            label: "Вечеря",
            macros: {},
          },
        ],
      },
    });
    expect(out["2026-02-02"].meals[0].mealType).toBe("dinner");
  });
});

describe("loadNutritionLog", () => {
  it("normalizes stored log", () => {
    globalThis.localStorage.setItem(
      NUTRITION_LOG_KEY,
      JSON.stringify({
        "2026-03-03": {
          meals: [{ name: "Тест", label: "Сніданок", macros: { kcal: 1 } }],
        },
      }),
    );
    const log = loadNutritionLog(NUTRITION_LOG_KEY);
    expect(log["2026-03-03"].meals[0].mealType).toBe("breakfast");
    expect(log["2026-03-03"].meals[0].id).toMatch(/^meal_/);
  });
});
