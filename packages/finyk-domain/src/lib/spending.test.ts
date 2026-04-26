import { describe, it, expect } from "vitest";
import { calcFinykPeriodAggregate } from "./spending.js";

const monday = new Date("2026-04-20T00:00:00").getTime();
const sunday = new Date("2026-04-27T00:00:00").getTime();

interface MakeTx {
  id: string;
  amount: number;
  time?: number;
  mcc?: number;
  description?: string;
}

function tx(t: MakeTx): MakeTx {
  return { time: monday + 3_600_000, ...t };
}

describe("calcFinykPeriodAggregate", () => {
  it("returns zeroes for empty input", () => {
    const r = calcFinykPeriodAggregate([], { start: monday, end: sunday });
    expect(r).toEqual({
      totalSpent: 0,
      totalIncome: 0,
      txCount: 0,
      byCategory: {},
    });
  });

  it("aggregates expenses and income inside the range", () => {
    const r = calcFinykPeriodAggregate(
      [
        tx({ id: "a", amount: -25_000 }),
        tx({ id: "b", amount: -7_500 }),
        tx({ id: "c", amount: 50_000 }),
      ],
      { start: monday, end: sunday },
    );
    expect(r.totalSpent).toBe(325);
    expect(r.totalIncome).toBe(500);
    expect(r.txCount).toBe(3);
    expect(r.byCategory).toEqual({ other: 325 });
  });

  it("excludes ids and respects unix-seconds time", () => {
    const r = calcFinykPeriodAggregate(
      [
        tx({ id: "a", amount: -10_000 }),
        // unix seconds (small) — same Monday slot
        { id: "b", amount: -20_000, time: (monday + 3_600_000) / 1000 },
        tx({ id: "skip", amount: -99_900 }),
      ],
      {
        start: monday,
        end: sunday,
        excludedTxIds: new Set(["skip"]),
      },
    );
    expect(r.totalSpent).toBe(300);
    expect(r.txCount).toBe(2);
  });

  it("ignores transactions outside the range", () => {
    const before = monday - 86_400_000;
    const after = sunday + 1;
    const r = calcFinykPeriodAggregate(
      [
        { id: "before", amount: -10_000, time: before },
        { id: "after", amount: -10_000, time: after },
        tx({ id: "in", amount: -10_000 }),
      ],
      { start: monday, end: sunday },
    );
    expect(r.totalSpent).toBe(100);
    expect(r.txCount).toBe(1);
  });

  it("buckets expenses by categoryKey()", () => {
    const r = calcFinykPeriodAggregate(
      [
        tx({ id: "a", amount: -10_000, mcc: 5411 }),
        tx({ id: "b", amount: -5_000, mcc: 5411 }),
        tx({ id: "c", amount: -2_500, mcc: 4111 }),
        tx({ id: "d", amount: 30_000 }), // income — never bucketed
      ],
      {
        start: monday,
        end: sunday,
        categoryKey: (t) => String(t.mcc ?? "other"),
      },
    );
    expect(r.byCategory).toEqual({
      "5411": 150,
      "4111": 25,
    });
    expect(r.totalSpent).toBe(175);
    expect(r.totalIncome).toBe(300);
    expect(r.txCount).toBe(4);
  });

  it("honors txSplits for expense amounts", () => {
    const r = calcFinykPeriodAggregate([tx({ id: "a", amount: -100_000 })], {
      start: monday,
      end: sunday,
      txSplits: {
        a: [
          { categoryId: "food", amount: 600 },
          // internal_transfer split is dropped
          { categoryId: "internal_transfer", amount: 400 },
        ],
      },
      categoryKey: (t) => String(t.mcc ?? "other"),
    });
    // Splits-aware: only 600 (the food split) counted, not the full 1000
    expect(r.totalSpent).toBe(600);
  });

  it("end is exclusive — sunday boundary tx counted in the next week, not this one", () => {
    const r = calcFinykPeriodAggregate(
      [{ id: "boundary", amount: -10_000, time: sunday }],
      { start: monday, end: sunday },
    );
    expect(r.txCount).toBe(0);
    expect(r.totalSpent).toBe(0);
  });
});
