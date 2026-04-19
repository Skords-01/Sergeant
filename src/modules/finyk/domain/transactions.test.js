import { describe, it, expect } from "vitest";
import {
  normalizeTransaction,
  normalizeManualExpense,
  normalizeTransactions,
  dedupeAndSortTransactions,
} from "./transactions";

describe("normalizeTransaction", () => {
  it("заповнює канонічні поля id/amount/date/type/source", () => {
    const tx = normalizeTransaction(
      {
        id: "abc",
        time: 1700000000,
        amount: -12345,
        description: "Kava",
        mcc: 5812,
      },
      { source: "monobank", accountId: "acc1" },
    );
    expect(tx.id).toBe("abc");
    expect(tx.amount).toBe(-12345);
    expect(tx.type).toBe("expense");
    expect(tx.source).toBe("mono");
    expect(tx.date).toBe(new Date(1700000000 * 1000).toISOString());
    expect(tx.merchant).toBe("Kava");
    expect(tx.description).toBe("Kava");
  });

  it("генерує id, якщо не задано", () => {
    const tx = normalizeTransaction({ amount: 100, date: "2024-05-01" });
    expect(typeof tx.id).toBe("string");
    expect(tx.id.length).toBeGreaterThan(0);
  });

  it("приводить date до ISO незалежно від вхідного формату", () => {
    const fromTime = normalizeTransaction({ time: 1700000000 });
    const fromDateStr = normalizeTransaction({ date: "2023-11-14T22:13:20Z" });
    const fromDateObj = normalizeTransaction({
      date: new Date("2023-11-14T22:13:20Z"),
    });
    expect(fromTime.date).toBe("2023-11-14T22:13:20.000Z");
    expect(fromDateStr.date).toBe("2023-11-14T22:13:20.000Z");
    expect(fromDateObj.date).toBe("2023-11-14T22:13:20.000Z");
  });

  it("гарантує, що amount — number (float → копійки, int → залишається)", () => {
    expect(normalizeTransaction({ amount: -12345 }).amount).toBe(-12345);
    expect(normalizeTransaction({ amount: 45.5 }).amount).toBe(4550);
    expect(normalizeTransaction({ amount: "abc" }).amount).toBe(0);
    expect(normalizeTransaction({}).amount).toBe(0);
  });

  it("type виводиться зі знаку amount, якщо явно не задано", () => {
    expect(normalizeTransaction({ amount: -100 }).type).toBe("expense");
    expect(normalizeTransaction({ amount: 100 }).type).toBe("income");
    expect(normalizeTransaction({ amount: 100, type: "transfer" }).type).toBe(
      "transfer",
    );
  });

  it("мапить легасі-джерела на канонічні значення і навпаки", () => {
    const mono = normalizeTransaction({ source: "monobank" });
    const privat = normalizeTransaction({ source: "privatbank" });
    const manual = normalizeTransaction({ source: "manual" });
    const ai = normalizeTransaction({ source: "ai" });
    expect(mono.source).toBe("mono");
    expect(mono._source).toBe("monobank");
    expect(privat.source).toBe("import");
    expect(privat._source).toBe("privatbank");
    expect(manual.source).toBe("manual");
    expect(manual._source).toBe("manual");
    expect(ai.source).toBe("ai");
    // Для 'ai' немає прямого легасі-значення; дефолт — 'manual'.
    expect(ai._source).toBe("manual");
  });

  it("categoryId беремо з categoryId, потім raw.category, потім category", () => {
    expect(normalizeTransaction({ categoryId: "food" }).categoryId).toBe(
      "food",
    );
    expect(
      normalizeTransaction({ raw: { category: "transport" } }).categoryId,
    ).toBe("transport");
    expect(normalizeTransaction({ category: "health" }).categoryId).toBe(
      "health",
    );
    expect(normalizeTransaction({}).categoryId).toBe("");
  });

  it("зберігає легасі-поля _source/_manual/_manualId/time для сумісності", () => {
    const tx = normalizeTransaction({
      time: 1700000000,
      amount: -100,
      _manual: true,
      _manualId: "42",
    });
    expect(tx._manual).toBe(true);
    expect(tx._manualId).toBe("42");
    expect(tx.time).toBe(1700000000);
    expect(tx._source).toBe("manual");
  });
});

describe("normalizeManualExpense", () => {
  it("перетворює ручну витрату (гривні) на уніфіковану транзакцію", () => {
    const tx = normalizeManualExpense({
      id: "42",
      date: "2024-05-01T12:00:00.000Z",
      description: "Кава",
      amount: 45.5,
      category: "їжа",
    });

    expect(tx.id).toBe("manual_42");
    expect(tx.amount).toBe(-4550);
    expect(tx.type).toBe("expense");
    expect(tx.source).toBe("manual");
    expect(tx._source).toBe("manual");
    expect(tx._manual).toBe(true);
    expect(tx._manualId).toBe("42");
    expect(tx.manualId).toBe("42");
    expect(tx.categoryId).toBe("їжа");
    expect(tx.date).toBe("2024-05-01T12:00:00.000Z");
    expect(tx.description).toBe("Кава");
  });

  it("генерує id/дату, якщо їх немає", () => {
    const tx = normalizeManualExpense({ amount: 10, description: "x" });
    expect(typeof tx.id).toBe("string");
    expect(typeof tx.date).toBe("string");
    expect(tx._manual).toBe(true);
    expect(tx.source).toBe("manual");
  });
});

describe("normalizeTransactions / dedupeAndSortTransactions", () => {
  it("нормалізує список і дедуплікує за id", () => {
    const xs = normalizeTransactions([
      { id: "1", time: 1, amount: -10 },
      { id: "1", time: 2, amount: -20 },
      { id: "2", time: 3, amount: -30 },
    ]);
    expect(xs).toHaveLength(3);

    const dedup = dedupeAndSortTransactions([
      { id: "1", time: 1, amount: -10 },
      { id: "1", time: 2, amount: -20 },
      { id: "2", time: 3, amount: -30 },
    ]);
    expect(dedup).toHaveLength(2);
    expect(dedup[0].id).toBe("2");
    expect(dedup[0].time).toBe(3);
  });
});
