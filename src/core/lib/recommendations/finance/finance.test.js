// Per-rule тести для модуля Finyk. Доводимо цінність реєстру: правило можна
// юніт-тестити без LS-мокінгу цілого engine.
import { describe, it, expect } from "vitest";
import { budgetLimitsRule } from "./budgetLimits.ts";
import { frequentNoBudgetRule } from "./frequentNoBudget.ts";
import { goalProgressRule } from "./goalProgress.ts";

function baseCtx(overrides = {}) {
  return {
    now: new Date("2025-06-15T12:00:00Z"),
    monthStart: new Date("2025-06-01T00:00:00Z"),
    transactions: [],
    manualExpenses: [],
    budgets: [],
    limits: [],
    txCategories: {},
    customCategories: [],
    hiddenTxIds: new Set(),
    transferIds: new Set(),
    thisMonthTx: [],
    categorySpend: {},
    canonicalMonthSpend: new Map(),
    canonicalTotalCount: new Map(),
    ...overrides,
  };
}

describe("budgetLimitsRule", () => {
  it("генерує over при >=140% ліміту", () => {
    const ctx = baseCtx({
      limits: [{ id: "b", type: "limit", categoryId: "food", limit: 500 }],
      categorySpend: { food: 900 },
    });
    const recs = budgetLimitsRule.evaluate(ctx);
    expect(recs[0]?.id).toBe("budget_over_food");
    expect(recs[0]?.priority).toBeGreaterThanOrEqual(80);
  });

  it("генерує warn при 90..139%", () => {
    const ctx = baseCtx({
      limits: [{ id: "b", type: "limit", categoryId: "cafe", limit: 100 }],
      categorySpend: { cafe: 95 },
    });
    const recs = budgetLimitsRule.evaluate(ctx);
    expect(recs[0]?.id).toBe("budget_warn_cafe");
  });

  it("нічого не повертає при 0 лімітах", () => {
    expect(budgetLimitsRule.evaluate(baseCtx())).toEqual([]);
  });

  it("ігнорує ліміти без categoryId або <=0", () => {
    const ctx = baseCtx({
      limits: [
        { id: "b1", type: "limit", categoryId: null, limit: 100 },
        { id: "b2", type: "limit", categoryId: "food", limit: 0 },
      ],
      categorySpend: { food: 200 },
    });
    expect(budgetLimitsRule.evaluate(ctx)).toEqual([]);
  });
});

describe("frequentNoBudgetRule", () => {
  it("повертає підказку для найчастішої категорії без ліміту", () => {
    const ctx = baseCtx({
      canonicalTotalCount: new Map([
        ["food", 10],
        ["transport", 3],
      ]),
      canonicalMonthSpend: new Map([["food", 1500]]),
    });
    const recs = frequentNoBudgetRule.evaluate(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("finyk_frequent_no_budget_food");
    expect(recs[0].title).toContain("Продукти");
    expect(recs[0].body).toContain("1");
  });

  it("пропускає категорії, для яких уже є ліміт", () => {
    const ctx = baseCtx({
      limits: [{ id: "b", type: "limit", categoryId: "food", limit: 500 }],
      canonicalTotalCount: new Map([["food", 20]]),
    });
    expect(frequentNoBudgetRule.evaluate(ctx)).toEqual([]);
  });

  it("не тригериться, якщо максимум <5 використань", () => {
    const ctx = baseCtx({
      canonicalTotalCount: new Map([["food", 4]]),
    });
    expect(frequentNoBudgetRule.evaluate(ctx)).toEqual([]);
  });

  it("підхоплює кастомний label", () => {
    const ctx = baseCtx({
      canonicalTotalCount: new Map([["myId", 7]]),
      customCategories: [{ id: "myId", label: "Собача їжа" }],
    });
    const rec = frequentNoBudgetRule.evaluate(ctx)[0];
    expect(rec.title).toContain("Собача їжа");
  });
});

describe("goalProgressRule", () => {
  it("тригериться при 80..99%", () => {
    const ctx = baseCtx({
      budgets: [
        {
          id: "g1",
          type: "goal",
          name: "Авто",
          targetAmount: 1000,
          savedAmount: 850,
        },
      ],
    });
    const recs = goalProgressRule.evaluate(ctx);
    expect(recs[0]?.id).toBe("goal_almost_g1");
    expect(recs[0].body).toContain("150");
  });

  it("ігнорує вже досягнуті цілі", () => {
    const ctx = baseCtx({
      budgets: [
        {
          id: "g1",
          type: "goal",
          targetAmount: 100,
          savedAmount: 100,
        },
      ],
    });
    expect(goalProgressRule.evaluate(ctx)).toEqual([]);
  });
});
