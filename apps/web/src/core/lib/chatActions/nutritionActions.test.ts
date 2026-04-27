// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleNutritionAction } from "./nutritionActions";
import type { ChatAction } from "./types";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-22T12:00:00"));
});
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

function call(action: ChatAction): string {
  const out = handleNutritionAction(action);
  if (typeof out !== "string") {
    throw new Error(`handler returned ${typeof out}, expected string`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// log_meal
// ---------------------------------------------------------------------------
describe("log_meal", () => {
  it("happy: logs meal with macros", () => {
    const out = call({
      name: "log_meal",
      input: {
        name: "Курка з рисом",
        kcal: 500,
        protein_g: 40,
        fat_g: 15,
        carbs_g: 50,
      },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Курка з рисом");
    expect(out).toContain("500");
  });

  it("error: empty name uses fallback (not thrown)", () => {
    const out = call({
      name: "log_meal",
      input: { name: "", kcal: 200 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Без назви");
  });

  it("shape: result is a non-empty string with meal id in storage", () => {
    const out = call({
      name: "log_meal",
      input: { name: "Яблуко", kcal: 50 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("записано");
    const log = JSON.parse(localStorage.getItem("nutrition_log_v1")!);
    expect(log["2026-04-22"].meals).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// log_water
// ---------------------------------------------------------------------------
describe("log_water", () => {
  it("happy: logs water intake", () => {
    const out = call({
      name: "log_water",
      input: { amount_ml: 500 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("500");
    expect(out).toContain("мл");
  });

  it("error: non-positive amount returns error", () => {
    const out = call({
      name: "log_water",
      input: { amount_ml: 0 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Некоректна");
  });

  it("shape: result is a non-empty string", () => {
    const out = call({
      name: "log_water",
      input: { amount_ml: 250 },
    });
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// add_recipe
// ---------------------------------------------------------------------------
describe("add_recipe", () => {
  it("happy: adds recipe", () => {
    const out = call({
      name: "add_recipe",
      input: {
        title: "Борщ",
        ingredients: ["буряк", "капуста"],
        servings: 4,
      },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Борщ");
    expect(out).toContain("збережено");
  });

  it("error: empty title returns error", () => {
    const out = call({
      name: "add_recipe",
      input: { title: "" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("назв");
  });

  it("shape: result is a non-empty string", () => {
    const out = call({
      name: "add_recipe",
      input: { title: "Каша" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Рецепт");
  });
});

// ---------------------------------------------------------------------------
// add_to_shopping_list
// ---------------------------------------------------------------------------
describe("add_to_shopping_list", () => {
  it("happy: adds item to shopping list", () => {
    const out = call({
      name: "add_to_shopping_list",
      input: { name: "Молоко" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Молоко");
    expect(out).toContain("додано");
  });

  it("happy: updates existing item", () => {
    call({ name: "add_to_shopping_list", input: { name: "Молоко" } });
    const out = call({
      name: "add_to_shopping_list",
      input: { name: "Молоко", quantity: "2л" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("оновлено");
  });

  it("error: empty name returns error", () => {
    const out = call({
      name: "add_to_shopping_list",
      input: { name: "" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Потрібна");
  });

  it("shape: result is a non-empty string", () => {
    const out = call({
      name: "add_to_shopping_list",
      input: { name: "Яблука", category: "Фрукти" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Фрукти");
  });
});

// ---------------------------------------------------------------------------
// consume_from_pantry
// ---------------------------------------------------------------------------
describe("consume_from_pantry", () => {
  it("happy: removes item from pantry", () => {
    localStorage.setItem(
      "nutrition_pantries_v1",
      JSON.stringify([
        { id: "home", name: "Домашня", items: [{ name: "Молоко" }] },
      ]),
    );
    const out = call({
      name: "consume_from_pantry",
      input: { name: "Молоко" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Молоко");
    expect(out).toContain("прибрано");
  });

  it("error: item not found in pantry returns error", () => {
    localStorage.setItem(
      "nutrition_pantries_v1",
      JSON.stringify([
        { id: "home", name: "Домашня", items: [{ name: "Хліб" }] },
      ]),
    );
    const out = call({
      name: "consume_from_pantry",
      input: { name: "nonexistent" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("не знайдено");
  });

  it("error: empty name returns error", () => {
    const out = call({
      name: "consume_from_pantry",
      input: { name: "" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Потрібна");
  });

  it("shape: result is a non-empty string", () => {
    localStorage.setItem(
      "nutrition_pantries_v1",
      JSON.stringify([
        { id: "home", name: "Домашня", items: [{ name: "Сир" }] },
      ]),
    );
    const out = call({
      name: "consume_from_pantry",
      input: { name: "Сир" },
    });
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// set_daily_plan
// ---------------------------------------------------------------------------
describe("set_daily_plan", () => {
  it("happy: sets daily nutrition targets", () => {
    const out = call({
      name: "set_daily_plan",
      input: { kcal: 2500, protein_g: 150 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("2500");
    expect(out).toContain("150");
  });

  it("error: no valid values returns error", () => {
    const out = call({
      name: "set_daily_plan",
      input: {},
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Немає");
  });

  it("shape: result persists to localStorage", () => {
    const out = call({
      name: "set_daily_plan",
      input: { kcal: 2000 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("оновлено");
    const prefs = JSON.parse(localStorage.getItem("nutrition_prefs_v1")!);
    expect(prefs.dailyTargetKcal).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// log_weight
// ---------------------------------------------------------------------------
describe("log_weight", () => {
  it("happy: logs weight", () => {
    const out = call({
      name: "log_weight",
      input: { weight_kg: 82 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("82");
    expect(out).toContain("кг");
  });

  it("error: invalid weight returns error", () => {
    const out = call({
      name: "log_weight",
      input: { weight_kg: -5 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("додатн");
  });

  it("shape: result is a non-empty string", () => {
    const out = call({
      name: "log_weight",
      input: { weight_kg: 80 },
    });
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// suggest_meal
// ---------------------------------------------------------------------------
describe("suggest_meal", () => {
  it("happy: returns meal suggestion based on prefs", () => {
    const out = call({
      name: "suggest_meal",
      input: {},
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Рекомендацію");
  });

  it("happy: includes focus when provided", () => {
    const out = call({
      name: "suggest_meal",
      input: { focus: "білок" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("білок");
  });

  it("shape: result always contains summary data", () => {
    localStorage.setItem(
      "nutrition_prefs_v1",
      JSON.stringify({ dailyTargetKcal: 2500, dailyTargetProtein_g: 150 }),
    );
    const out = call({ name: "suggest_meal", input: {} });
    expect(typeof out).toBe("string");
    expect(out).toContain("ккал");
  });
});

// ---------------------------------------------------------------------------
// copy_meal_from_date
// ---------------------------------------------------------------------------
describe("copy_meal_from_date", () => {
  it("happy: copies meals from source date", () => {
    localStorage.setItem(
      "nutrition_log_v1",
      JSON.stringify({
        "2026-04-20": {
          meals: [
            {
              id: "m_old",
              name: "Сніданок",
              macros: { kcal: 400, protein_g: 30, fat_g: 15, carbs_g: 40 },
              addedAt: "2026-04-20T08:00:00.000Z",
            },
          ],
        },
      }),
    );
    const out = call({
      name: "copy_meal_from_date",
      input: { source_date: "2026-04-20" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Скопійовано");
    expect(out).toContain("1");
    expect(out).toContain("400");
  });

  it("error: invalid date format returns error", () => {
    const out = call({
      name: "copy_meal_from_date",
      input: { source_date: "bad" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("YYYY-MM-DD");
  });

  it("error: no meals on source date returns error", () => {
    const out = call({
      name: "copy_meal_from_date",
      input: { source_date: "2026-04-01" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("немає");
  });

  it("shape: result is a non-empty string", () => {
    localStorage.setItem(
      "nutrition_log_v1",
      JSON.stringify({
        "2026-04-20": {
          meals: [
            {
              id: "m1",
              name: "X",
              macros: { kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 15 },
              addedAt: "2026-04-20T10:00:00.000Z",
            },
          ],
        },
      }),
    );
    const out = call({
      name: "copy_meal_from_date",
      input: { source_date: "2026-04-20", meal_index: 0 },
    });
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// plan_meals_for_day
// ---------------------------------------------------------------------------
describe("plan_meals_for_day", () => {
  it("happy: plans meals based on targets", () => {
    const out = call({
      name: "plan_meals_for_day",
      input: { target_kcal: 2000, meals_count: 4 },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("4");
    expect(out).toContain("2000");
    expect(out).toContain("500");
  });

  it("happy: uses defaults when no input", () => {
    const out = call({
      name: "plan_meals_for_day",
      input: {},
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("Планую");
  });

  it("shape: result is a non-empty string with recommendation", () => {
    const out = call({
      name: "plan_meals_for_day",
      input: { preferences: "вегетаріанська" },
    });
    expect(typeof out).toBe("string");
    expect(out).toContain("вегетаріанська");
    expect(out).toContain("Рекомендацію");
  });
});
