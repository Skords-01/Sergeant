import { describe, it, expect } from "vitest";
import { BudgetSchema, BudgetsSchema } from "./schemas";

describe("BudgetSchema", () => {
  it("приймає limit-бюджет з валідним числовим limit", () => {
    const r = BudgetSchema.safeParse({
      id: "b1",
      type: "limit",
      limit: 500,
      categoryId: "food",
    });
    expect(r.success).toBe(true);
  });

  it("приймає goal-бюджет з порожнім limit (legacy-форма)", () => {
    // Goal-бюджети успадковують `limit: ""` із initial-state форми у
    // Budgets.jsx. Раніше такі записи мовчки фільтрувалися у getBudget().
    const r = BudgetSchema.safeParse({
      id: "g1",
      type: "goal",
      limit: "",
      target: 10000,
      current: 2500,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBeUndefined();
  });

  it("приймає goal-бюджет без поля limit взагалі", () => {
    const r = BudgetSchema.safeParse({
      id: "g2",
      type: "goal",
      target: 5000,
    });
    expect(r.success).toBe(true);
  });

  it("нормалізує string-числа у limit", () => {
    const r = BudgetSchema.safeParse({ id: "b3", limit: "750" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(750);
  });

  it("дропає запис без id", () => {
    const r = BudgetSchema.safeParse({ limit: 100 });
    expect(r.success).toBe(false);
  });

  it("масив: валідні goal + limit записи обидва проходять", () => {
    const r = BudgetsSchema.safeParse([
      { id: "g1", type: "goal", limit: "", target: 10000 },
      { id: "l1", type: "limit", limit: 500, categoryId: "food" },
    ]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toHaveLength(2);
  });
});
