import { describe, it, expect } from "vitest";
import { normalizeFinykBackup, FINYK_BACKUP_VERSION } from "./finykBackup.js";

describe("normalizeFinykBackup", () => {
  it("приймає мінімальний v1 без додаткових полів", () => {
    expect(normalizeFinykBackup({ version: 1, budgets: [] })).toEqual({ budgets: [] });
  });

  it("приймає повний v2", () => {
    const full = {
      version: FINYK_BACKUP_VERSION,
      budgets: [],
      subscriptions: [],
      manualAssets: [],
      manualDebts: [],
      receivables: [],
      hiddenAccounts: [],
      hiddenTxIds: [],
      monthlyPlan: { income: "", expense: "", savings: "" },
      txCategories: { a: "b" },
      txSplits: {},
      monoDebtLinkedTxIds: {},
      networthHistory: [{ month: "2026-01", networth: 100 }],
    };
    expect(normalizeFinykBackup(full)).toMatchObject({
      txCategories: { a: "b" },
      networthHistory: [{ month: "2026-01", networth: 100 }],
    });
  });

  it("відхиляє txCategories-масив", () => {
    expect(() => normalizeFinykBackup({ version: 2, txCategories: [] })).toThrow(/об'єктом/);
  });
});
