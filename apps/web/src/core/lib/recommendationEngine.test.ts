// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateRecommendations } from "./recommendationEngine.js";

function setLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clearAll() {
  localStorage.clear();
}

describe("generateRecommendations", () => {
  beforeEach(clearAll);
  afterEach(clearAll);

  it("повертає масив навіть при порожньому localStorage", () => {
    const result = generateRecommendations();
    expect(Array.isArray(result)).toBe(true);
  });

  it("кожна рекомендація має обовʼязкові поля", () => {
    const result = generateRecommendations();
    for (const r of result) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("module");
      expect(r).toHaveProperty("icon");
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("body");
      expect(r).toHaveProperty("priority");
    }
  });

  it("не дублює id рекомендацій", () => {
    const result = generateRecommendations();
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("виявляє перевищення бюджету", () => {
    const now = new Date();
    // Транзакція поточного місяця: витрата 1000 грн * 100 (копійки) у категорії food
    const ts = Math.floor(now.getTime() / 1000);
    setLS("finyk_tx_cache", {
      txs: [{ id: "tx1", amount: -100000, time: ts, description: "Продукти" }],
    });
    setLS("finyk_tx_cats", { tx1: "food" });
    // Ліміт 500 грн (50% від фактичних витрат → 200% → перевищення)
    setLS("finyk_budgets", [
      { id: "b1", type: "limit", categoryId: "food", limit: 500 },
    ]);

    const recs = generateRecommendations();
    const budgetRec = recs.find((r) => r.id === "budget_over_food");
    expect(budgetRec).toBeDefined();
    expect(budgetRec.module).toBe("finyk");
    expect(budgetRec.priority).toBeGreaterThanOrEqual(80);
  });

  it("показує попередження якщо бюджет майже вичерпано (90%+)", () => {
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000);
    setLS("finyk_tx_cache", {
      txs: [{ id: "tx2", amount: -95000, time: ts, description: "Кафе" }],
    });
    setLS("finyk_tx_cats", { tx2: "cafe" });
    setLS("finyk_budgets", [
      { id: "b2", type: "limit", categoryId: "cafe", limit: 100 },
    ]);

    const recs = generateRecommendations();
    const warnRec = recs.find(
      (r) => r.id === "budget_warn_cafe" || r.id === "budget_over_cafe",
    );
    expect(warnRec).toBeDefined();
  });

  it("генерує рекомендацію про тренування якщо тиждень без тренувань", () => {
    // Останнє тренування > 7 днів тому
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    setLS("fizruk_workouts_v1", {
      schemaVersion: 1,
      workouts: [
        {
          id: "w1",
          startedAt: oldDate.toISOString(),
          endedAt: new Date(oldDate.getTime() + 3600000).toISOString(),
          items: [],
        },
      ],
    });

    const recs = generateRecommendations();
    const fitnessRec = recs.find((r) => r.module === "fizruk");
    expect(fitnessRec).toBeDefined();
  });
});
