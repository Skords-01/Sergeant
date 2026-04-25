// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildActionCard, isRiskyTool } from "./hubChatActionCards";

describe("buildActionCard", () => {
  it("повертає картку для основного tool-а (create_transaction)", () => {
    const card = buildActionCard({
      name: "create_transaction",
      input: { amount: 120, description: "кава" },
      result: "Витрату 120 ₴ записано",
    });
    expect(card).not.toBeNull();
    expect(card?.toolName).toBe("create_transaction");
    expect(card?.status).toBe("completed");
    expect(card?.module).toBe("finyk");
    expect(card?.title).toContain("Транзакцію");
    expect(card?.summary).toContain("120");
    expect(card?.summary).toContain("кава");
  });

  it("повертає null для невідомого tool-а", () => {
    const card = buildActionCard({
      name: "some_internal_lookup",
      input: {},
      result: "ok",
    });
    expect(card).toBeNull();
  });

  it("позначає failed коли result починається з «Помилка»", () => {
    const card = buildActionCard({
      name: "log_set",
      input: { exercise: "жим", weight_kg: 80, reps: 8 },
      result: "Помилка виконання: щось зламалося",
    });
    expect(card?.status).toBe("failed");
    expect(card?.title).toMatch(/не вийшло/);
  });

  it("позначає failed коли result починається з «Невідома дія»", () => {
    const card = buildActionCard({
      name: "log_meal",
      input: {},
      result: "Невідома дія: log_meal",
    });
    expect(card?.status).toBe("failed");
  });

  it("приймає explicit failed=true навіть якщо текст ок", () => {
    const card = buildActionCard({
      name: "log_water",
      input: { amount_ml: 250 },
      result: "ok",
      failed: true,
    });
    expect(card?.status).toBe("failed");
  });

  it("витягує summary для log_set з input полів", () => {
    const card = buildActionCard({
      name: "log_set",
      input: { exercise: "жим лежачи", weight_kg: 80, reps: 8 },
      result: "Підхід додано",
    });
    expect(card?.summary).toContain("жим лежачи");
    expect(card?.summary).toContain("80");
    expect(card?.summary).toContain("8");
  });

  it("витягує summary для log_meal", () => {
    const card = buildActionCard({
      name: "log_meal",
      input: { meal_type: "сніданок", description: "вівсянка", calories: 350 },
      result: "Залоговано",
    });
    expect(card?.summary).toContain("сніданок");
    expect(card?.summary).toContain("вівсянка");
    expect(card?.summary).toContain("350");
  });

  it("витягує summary для log_water", () => {
    const card = buildActionCard({
      name: "log_water",
      input: { amount_ml: 500 },
      result: "ok",
    });
    expect(card?.summary).toBe("500 мл");
  });

  it("ставить module=finyk для create_transaction", () => {
    const card = buildActionCard({
      name: "create_transaction",
      input: {},
      result: "ok",
    });
    expect(card?.module).toBe("finyk");
  });

  it("ставить module=fizruk для log_set", () => {
    const card = buildActionCard({
      name: "log_set",
      input: {},
      result: "ok",
    });
    expect(card?.module).toBe("fizruk");
  });

  it("ставить module=routine для mark_habit_done", () => {
    const card = buildActionCard({
      name: "mark_habit_done",
      input: { habit_id: "вода" },
      result: "ok",
    });
    expect(card?.module).toBe("routine");
    expect(card?.summary).toBe("вода");
  });

  it("ставить module=nutrition для log_meal", () => {
    const card = buildActionCard({
      name: "log_meal",
      input: {},
      result: "ok",
    });
    expect(card?.module).toBe("nutrition");
  });

  it("ставить module=hub для morning_briefing", () => {
    const card = buildActionCard({
      name: "morning_briefing",
      input: {},
      result: "ok",
    });
    expect(card?.module).toBe("hub");
    expect(card?.title).toContain("брифінг");
  });

  it("картка для morning_briefing і weekly_summary не risky", () => {
    const briefing = buildActionCard({
      name: "morning_briefing",
      input: {},
      result: "ok",
    });
    const summary = buildActionCard({
      name: "weekly_summary",
      input: {},
      result: "ok",
    });
    expect(briefing?.risky).toBeUndefined();
    expect(summary?.risky).toBeUndefined();
  });

  it("кожна картка має непустий id, title і summary", () => {
    const card = buildActionCard({
      name: "create_habit",
      input: { name: "Пити воду" },
      result: "ok",
    });
    expect(card?.id).toMatch(/^card_/);
    expect(card?.title.length).toBeGreaterThan(0);
    expect(card?.summary.length).toBeGreaterThan(0);
  });
});

describe("isRiskyTool", () => {
  it("розпізнає risky tools", () => {
    expect(isRiskyTool("delete_transaction")).toBe(true);
    expect(isRiskyTool("hide_transaction")).toBe(true);
    expect(isRiskyTool("forget")).toBe(true);
    expect(isRiskyTool("archive_habit")).toBe(true);
    expect(isRiskyTool("import_monobank_range")).toBe(true);
  });

  it("звичайні tools — не risky", () => {
    expect(isRiskyTool("create_transaction")).toBe(false);
    expect(isRiskyTool("log_meal")).toBe(false);
    expect(isRiskyTool("morning_briefing")).toBe(false);
  });
});
