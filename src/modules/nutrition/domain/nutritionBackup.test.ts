import { beforeEach, describe, expect, it } from "vitest";
import {
  applyNutritionBackupPayload,
  buildNutritionBackupPayload,
  NUTRITION_BACKUP_KIND,
} from "./nutritionBackup.js";
import {
  NUTRITION_ACTIVE_PANTRY_KEY,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_PREFS_KEY,
} from "../lib/nutritionStorage.js";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => void store.set(String(k), String(v)),
    removeItem: (k) => void store.delete(String(k)),
    clear: () => void store.clear(),
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock() as Storage;
});

describe("nutrition backup", () => {
  it("builds stable payload with defaults", () => {
    const p = buildNutritionBackupPayload();
    expect(p.kind).toBe(NUTRITION_BACKUP_KIND);
    expect(p.data.pantries).toBeInstanceOf(Array);
    expect(p.data.prefs).toBeTruthy();
  });

  it("apply persists keys", () => {
    applyNutritionBackupPayload({
      kind: NUTRITION_BACKUP_KIND,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        stateSchemaVersion: 1,
        pantries: [
          { id: "home", name: "Дім", text: "яйця", items: [{ name: "яйця" }] },
        ],
        activePantryId: "home",
        prefs: { goal: "balanced", servings: 2, timeMinutes: 10, exclude: "" },
      },
    });
    expect(globalThis.localStorage.getItem(NUTRITION_PANTRIES_KEY)).toContain(
      "яйця",
    );
    expect(globalThis.localStorage.getItem(NUTRITION_ACTIVE_PANTRY_KEY)).toBe(
      "home",
    );
    expect(globalThis.localStorage.getItem(NUTRITION_PREFS_KEY)).toContain(
      '"servings":2',
    );
  });
});
