import { describe, it, expect } from "vitest";
import {
  formatComparisonSummary,
  getCurrentVsPreviousComparison,
} from "./selectors";
import type { Transaction } from "./types";

// Minimal tx factory — fills only the fields our aggregation actually reads
// (`time`, `amount`, `id`) so tests stay readable and focused.
function tx(
  id: string,
  isoDate: string,
  amount: number,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    amount,
    time: Math.floor(new Date(isoDate).getTime() / 1000),
    date: isoDate,
    description: "",
    mcc: 0,
    accountId: null,
    manual: false,
    categoryId: "misc",
    type: amount < 0 ? "expense" : "income",
    source: "manual",
    _source: "manual",
    _accountId: null,
    _manual: false,
    ...extra,
  };
}

describe("getCurrentVsPreviousComparison", () => {
  it("compares current and previous calendar months by default", () => {
    const txs = [
      // Березень 2025 — поточний
      tx("c1", "2025-03-05T10:00:00Z", -50000),
      tx("c2", "2025-03-15T10:00:00Z", -30000),
      tx("c3", "2025-03-20T10:00:00Z", 400000),
      // Лютий 2025 — попередній
      tx("p1", "2025-02-10T10:00:00Z", -40000),
      tx("p2", "2025-02-20T10:00:00Z", -20000),
      tx("p3", "2025-02-25T10:00:00Z", 300000),
      // Січень — ігнорується
      tx("j1", "2025-01-10T10:00:00Z", -99999),
    ];
    const result = getCurrentVsPreviousComparison(txs, {
      now: new Date("2025-03-21T00:00:00Z"),
    });

    expect(result.currentMonth).toBe("2025-03");
    expect(result.previousMonth).toBe("2025-02");
    expect(result.currentSpent).toBe(800);
    expect(result.prevSpent).toBe(600);
    expect(result.diff).toBe(200);
    expect(result.diffPct).toBe(33);
    expect(result.currentIncome).toBe(4000);
    expect(result.prevIncome).toBe(3000);
    expect(result.incomeDiff).toBe(1000);
    expect(result.incomeDiffPct).toBe(33);
  });

  it("wraps from January back to previous December", () => {
    const txs = [
      tx("c", "2025-01-15T10:00:00Z", -10000),
      tx("p", "2024-12-15T10:00:00Z", -20000),
    ];
    const result = getCurrentVsPreviousComparison(txs, {
      now: new Date("2025-01-20T00:00:00Z"),
    });
    expect(result.currentMonth).toBe("2025-01");
    expect(result.previousMonth).toBe("2024-12");
    expect(result.currentSpent).toBe(100);
    expect(result.prevSpent).toBe(200);
    expect(result.diff).toBe(-100);
    expect(result.diffPct).toBe(-50);
  });

  it("returns null diffPct when there is no previous-month spend", () => {
    const txs = [tx("c", "2025-03-05T10:00:00Z", -10000)];
    const result = getCurrentVsPreviousComparison(txs, {
      now: new Date("2025-03-10T00:00:00Z"),
    });
    expect(result.prevSpent).toBe(0);
    expect(result.diffPct).toBeNull();
    expect(result.incomeDiffPct).toBeNull();
  });

  it("respects excludedTxIds in both periods", () => {
    const txs = [
      tx("c1", "2025-03-05T10:00:00Z", -50000),
      tx("c2", "2025-03-15T10:00:00Z", -30000),
      tx("p1", "2025-02-10T10:00:00Z", -40000),
      tx("p2", "2025-02-20T10:00:00Z", -20000),
    ];
    const result = getCurrentVsPreviousComparison(txs, {
      now: new Date("2025-03-21T00:00:00Z"),
      excludedTxIds: new Set(["c2", "p2"]),
    });
    expect(result.currentSpent).toBe(500);
    expect(result.prevSpent).toBe(400);
    expect(result.diff).toBe(100);
  });

  it("accepts explicit currentMonth/previousMonth overrides", () => {
    const txs = [
      tx("c", "2024-07-05T10:00:00Z", -10000),
      tx("p", "2024-05-05T10:00:00Z", -5000),
    ];
    const result = getCurrentVsPreviousComparison(txs, {
      currentMonth: "2024-07",
      previousMonth: "2024-05",
    });
    expect(result.currentMonth).toBe("2024-07");
    expect(result.previousMonth).toBe("2024-05");
    expect(result.currentSpent).toBe(100);
    expect(result.prevSpent).toBe(50);
    expect(result.diffPct).toBe(100);
  });
});

describe("formatComparisonSummary", () => {
  it("describes an increase with sign and percent", () => {
    const summary = formatComparisonSummary({
      currentSpent: 1200,
      prevSpent: 1000,
      diff: 200,
      diffPct: 20,
    });
    expect(summary.direction).toBe("up");
    expect(summary.text).toContain("більше");
    expect(summary.text).toContain("20%");
  });

  it("describes a decrease", () => {
    const summary = formatComparisonSummary({
      currentSpent: 800,
      prevSpent: 1000,
      diff: -200,
      diffPct: -20,
    });
    expect(summary.direction).toBe("down");
    expect(summary.text).toContain("менше");
    expect(summary.text).toContain("20%");
  });

  it("handles zero diff", () => {
    const summary = formatComparisonSummary({
      currentSpent: 500,
      prevSpent: 500,
      diff: 0,
      diffPct: 0,
    });
    expect(summary.direction).toBe("equal");
    expect(summary.text).toMatch(/такі сам/);
  });

  it("handles missing previous data", () => {
    const summary = formatComparisonSummary({
      currentSpent: 500,
      prevSpent: 0,
      diff: 500,
      diffPct: null,
    });
    expect(summary.direction).toBe("no_prev");
  });

  it("uses provided prevLabel in the sentence", () => {
    const summary = formatComparisonSummary(
      { currentSpent: 1200, prevSpent: 1000, diff: 200, diffPct: 20 },
      { prevLabel: "лютого 2025" },
    );
    expect(summary.text).toContain("лютого 2025");
  });

  it("returns no_prev when comparison itself is null", () => {
    const summary = formatComparisonSummary(null);
    expect(summary.direction).toBe("no_prev");
  });
});
