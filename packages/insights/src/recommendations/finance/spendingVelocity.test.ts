// Per-rule тести для spendingVelocity: тренд витрат поточний тиждень
// vs минулий, нормалізований до того ж дня тижня. Спрацьовує тільки
// з середи (dowIdx ≥ 2), щоб не блимати у пн/вт з мінімумом даних.
import { describe, expect, it } from "vitest";
import { spendingVelocityRule } from "./spendingVelocity.js";
import type { FinanceContext } from "../financeContext.js";

function baseCtx(overrides: Partial<FinanceContext> = {}): FinanceContext {
  return {
    // Wednesday 2025-06-18 12:00 UTC → dowIdx=2 (gate щойно відкрився).
    now: new Date("2025-06-18T12:00:00Z"),
    monthStart: new Date("2025-06-01T00:00:00Z"),
    transactions: [],
    manualExpenses: [],
    budgets: [],
    limits: [],
    txCategories: {},
    customCategories: [],
    hiddenTxIds: new Set<string>(),
    transferIds: new Set<string>(),
    thisMonthTx: [],
    categorySpend: {},
    canonicalMonthSpend: new Map(),
    canonicalTotalCount: new Map(),
    ...overrides,
  };
}

// Helpers, що будують Mono-style транзакції зі знаком "amount" у копійках.
function tx(
  id: string,
  amount: number,
  isoDate: string,
): FinanceContext["transactions"][number] {
  // Amount у копійках, від'ємне = витрата (узгоджено з spendingVelocity.ts §31).
  return {
    id,
    amount,
    time: new Date(isoDate).getTime(), // ms — алгоритм нормалізує >1e10.
  };
}

describe("spendingVelocityRule", () => {
  describe("dow-gate (понеділок-вівторок)", () => {
    it("повертає [] у понеділок", () => {
      // 2025-06-16 = Mon; dowIdx=0 < 2.
      const ctx = baseCtx({ now: new Date("2025-06-16T12:00:00Z") });
      expect(spendingVelocityRule.evaluate(ctx)).toEqual([]);
    });

    it("повертає [] у вівторок", () => {
      // 2025-06-17 = Tue; dowIdx=1 < 2.
      const ctx = baseCtx({ now: new Date("2025-06-17T12:00:00Z") });
      expect(spendingVelocityRule.evaluate(ctx)).toEqual([]);
    });

    it("спрацьовує у середу (gate-edge, dowIdx=2)", () => {
      const ctx = baseCtx({
        now: new Date("2025-06-18T12:00:00Z"),
        // Цей тиждень: Mon-Tue+Wed = 1500 ₴
        manualExpenses: [
          { amount: 750, date: "2025-06-16T10:00:00Z" },
          { amount: 750, date: "2025-06-17T10:00:00Z" },
        ],
        // Минулий тиждень: відповідний інтервал = 1000 ₴ (mb 1.5x → over-threshold)
        transactions: [
          // -1000 ₴ → 100000 копійок зі знаком мінус.
          tx("a", -100000, "2025-06-09T10:00:00Z"),
        ],
      });
      const out = spendingVelocityRule.evaluate(ctx);
      expect(out).toHaveLength(1);
      expect(out[0]!.id).toBe("spending_velocity_high");
    });
  });

  describe("threshold gate (prevSpend >= 500, thisSpend > 0)", () => {
    it("[] коли prevSpend < 500", () => {
      const ctx = baseCtx({
        manualExpenses: [{ amount: 600, date: "2025-06-17T10:00:00Z" }],
        transactions: [tx("a", -49900, "2025-06-09T10:00:00Z")], // 499 ₴
      });
      expect(spendingVelocityRule.evaluate(ctx)).toEqual([]);
    });

    it("[] коли thisSpend == 0 (рівне 0)", () => {
      const ctx = baseCtx({
        manualExpenses: [],
        transactions: [tx("a", -100000, "2025-06-09T10:00:00Z")],
      });
      expect(spendingVelocityRule.evaluate(ctx)).toEqual([]);
    });
  });

  describe("ratio rules", () => {
    it("ratio >= 1.4 → spending_velocity_high (priority 75, icon 📈)", () => {
      // prev = 1000 ₴; this = 1500 ₴ → ratio 1.5 ≥ 1.4
      const ctx = baseCtx({
        transactions: [tx("p", -100000, "2025-06-09T10:00:00Z")],
        manualExpenses: [{ amount: 1500, date: "2025-06-17T10:00:00Z" }],
      });
      const out = spendingVelocityRule.evaluate(ctx);
      expect(out).toHaveLength(1);
      const rec = out[0]!;
      expect(rec.id).toBe("spending_velocity_high");
      expect(rec.module).toBe("finyk");
      expect(rec.priority).toBe(75);
      expect(rec.icon).toBe("📈");
      expect(rec.action).toBe("finyk");
      expect(rec.title).toBe("Витрати на 50% вище ніж минулого тижня");
      // toLocaleString("uk-UA") для рос/укр використовує narrow-no-break-space (U+202F).
      expect(rec.body).toMatch(
        /1[\s\u202f\u00a0]500 ₴ vs 1[\s\u202f\u00a0]000 ₴/,
      );
    });

    it("ratio <= 0.6 → spending_velocity_low (priority 45, icon 👏)", () => {
      // prev = 1000 ₴; this = 500 ₴ → ratio 0.5 ≤ 0.6
      const ctx = baseCtx({
        transactions: [tx("p", -100000, "2025-06-09T10:00:00Z")],
        manualExpenses: [{ amount: 500, date: "2025-06-17T10:00:00Z" }],
      });
      const out = spendingVelocityRule.evaluate(ctx);
      expect(out).toHaveLength(1);
      const rec = out[0]!;
      expect(rec.id).toBe("spending_velocity_low");
      expect(rec.priority).toBe(45);
      expect(rec.icon).toBe("👏");
      expect(rec.title).toBe("Витрати на 50% нижче ніж минулого тижня");
    });

    it("[] коли ratio в нейтральній зоні (0.6, 1.4)", () => {
      // prev = 1000 ₴; this = 1000 ₴ → ratio 1.0
      const ctx = baseCtx({
        transactions: [tx("p", -100000, "2025-06-09T10:00:00Z")],
        manualExpenses: [{ amount: 1000, date: "2025-06-17T10:00:00Z" }],
      });
      expect(spendingVelocityRule.evaluate(ctx)).toEqual([]);
    });
  });

  describe("filtering у sumSpending", () => {
    it("ігнорує hiddenTxIds + transferIds + позитивні amount-и", () => {
      // prev: 1000 ₴ (одна валідна транзакція) + три, що мають бути проігноровані.
      const ctx = baseCtx({
        transactions: [
          tx("p_keep", -100000, "2025-06-09T10:00:00Z"), // прийнято
          tx("p_hidden", -50000, "2025-06-10T10:00:00Z"), // hidden
          tx("p_transfer", -50000, "2025-06-11T10:00:00Z"), // transfer
          tx("p_income", 50000, "2025-06-09T11:00:00Z"), // amount ≥ 0
        ],
        hiddenTxIds: new Set(["p_hidden"]),
        transferIds: new Set(["p_transfer"]),
        manualExpenses: [{ amount: 1500, date: "2025-06-17T10:00:00Z" }],
      });
      const rec = spendingVelocityRule.evaluate(ctx)[0]!;
      // Якщо фільтри не сработали — prev ≠ 1000, ratio був би іншим (1.5 → 50%).
      expect(rec.id).toBe("spending_velocity_high");
      expect(rec.title).toContain("50%");
    });

    it("amount=0 проходить через >=0 гілку (тобто ігнорується)", () => {
      // edge: tx з amount=0 — формально ≥ 0, тож має бути проігнорований.
      const ctx = baseCtx({
        transactions: [
          tx("zero", 0, "2025-06-17T10:00:00Z"),
          tx("p", -100000, "2025-06-09T10:00:00Z"),
        ],
        manualExpenses: [{ amount: 1500, date: "2025-06-17T10:00:00Z" }],
      });
      // amount=0 не мав вплинути; prev=1000, this=1500 → ratio 1.5.
      expect(spendingVelocityRule.evaluate(ctx)[0]!.id).toBe(
        "spending_velocity_high",
      );
    });

    it("ManualExpense.amount як рядок NaN → парситься у 0 (Number coercion)", () => {
      // У сирому LS amount інколи приходить рядком ("not-a-number").
      // sumSpending має використати `Number(...) || 0`.
      const ctx = baseCtx({
        transactions: [tx("p", -100000, "2025-06-09T10:00:00Z")],
        manualExpenses: [
          // amount як невалідний string зі стану старого LS.
          {
            amount: "garbage" as unknown as number,
            date: "2025-06-17T10:00:00Z",
          },
          { amount: 1500, date: "2025-06-17T10:00:00Z" },
        ],
      });
      expect(spendingVelocityRule.evaluate(ctx)[0]!.id).toBe(
        "spending_velocity_high",
      );
    });

    it("транзакції поза вікном не враховуються (рівно на межі вікна)", () => {
      // cmpEnd ексклюзивний: tx у самий момент cmpEnd має бути проігнорована.
      // dowIdx=2 при now=Wed; cmpEnd = thisWeekStart + dowIdx + 1 = Sat 00:00.
      // У поточному тижні (Mon 06-16 → Sat 06-21 exclusive) tx Sat 12:00 ігнорується.
      const ctx = baseCtx({
        transactions: [
          tx("p", -100000, "2025-06-09T10:00:00Z"), // prev: ✓
          tx("future", -200000, "2025-06-21T12:00:00Z"), // this week, після cmpEnd
        ],
        manualExpenses: [{ amount: 1500, date: "2025-06-17T10:00:00Z" }],
      });
      // Якби "future" враховувалось, this був би 3500 → ratio 3.5 → 250%.
      const rec = spendingVelocityRule.evaluate(ctx)[0]!;
      expect(rec.title).toContain("50%"); // 1500/1000 = 1.5
    });
  });

  describe("Unix-seconds vs ms timestamp (txTimestamp евристика)", () => {
    it("Mono-API time у seconds (< 1e10) теж потрапляє у вікно", () => {
      // 2025-06-09 10:00 UTC у seconds.
      const tsSec = Math.floor(
        new Date("2025-06-09T10:00:00Z").getTime() / 1000,
      );
      const ctx = baseCtx({
        transactions: [{ id: "p_sec", amount: -100000, time: tsSec }],
        manualExpenses: [{ amount: 1500, date: "2025-06-17T10:00:00Z" }],
      });
      expect(spendingVelocityRule.evaluate(ctx)[0]!.id).toBe(
        "spending_velocity_high",
      );
    });
  });
});
