import { describe, expect, it } from "vitest";
import {
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getDebtOriginated,
  getDebtPaid,
  getDebtTxRole,
  getReceivableEffectiveTotal,
  getReceivableOriginated,
  getReceivablePaid,
  getReceivableTxRole,
} from "./debtEngine.js";

describe("debtEngine — борг (я винен)", () => {
  it("calcDebtRemaining: база + виникнення − сплати", () => {
    const debt = {
      totalAmount: 1000,
      linkedTxIds: ["origin1", "pay1"],
    } as never;
    const transactions = [
      { id: "origin1", amount: 50_000 }, // +500 ₴ виникнення (копійки)
      { id: "pay1", amount: -200_00 }, // −200 ₴ сплата
    ];
    // ефективно: 1000 + 500 − 200 = 1300
    expect(calcDebtRemaining(debt, transactions)).toBe(1300);
  });

  it("calcDebtRemaining: не менше нуля при переплаті", () => {
    const debt = { totalAmount: 100, linkedTxIds: ["p1"] } as never;
    const transactions = [{ id: "p1", amount: -500_00 }];
    expect(calcDebtRemaining(debt, transactions)).toBe(0);
  });

  it("getDebtPaid рахує лише витрати (amount < 0)", () => {
    const debt = { linkedTxIds: ["a", "b"] } as never;
    const transactions = [
      { id: "a", amount: -100_00 },
      { id: "b", amount: 50_00 },
    ];
    expect(getDebtPaid(debt, transactions)).toBe(100);
  });

  it("getDebtOriginated рахує лише надходження (amount > 0)", () => {
    const debt = { linkedTxIds: ["a", "b"] } as never;
    const transactions = [
      { id: "a", amount: 25_00 },
      { id: "b", amount: -10_00 },
    ];
    expect(getDebtOriginated(debt, transactions)).toBe(25);
  });

  it("getDebtEffectiveTotal зводить базу та виникнення", () => {
    const debt = { totalAmount: 300, linkedTxIds: ["o"] } as never;
    const transactions = [{ id: "o", amount: 100_00 }];
    expect(getDebtEffectiveTotal(debt, transactions)).toBe(400);
  });

  it("getDebtTxRole розрізняє виникнення та сплату", () => {
    expect(getDebtTxRole({ amount: 100 }).kind).toBe("origin");
    expect(getDebtTxRole({ amount: -50 }).kind).toBe("payment");
  });
});

describe("debtEngine — дебіторка (мені винні)", () => {
  it("calcReceivableRemaining: база + виникнення − погашення", () => {
    const rec = {
      amount: 800,
      linkedTxIds: ["orig", "pay"],
    } as never;
    const transactions = [
      { id: "orig", amount: -40_00 }, // +40 до боргу перед тобою
      { id: "pay", amount: 250_00 }, // +250 погашення
    ];
    // ефективно: 800 + 40 − 250 = 590
    expect(calcReceivableRemaining(rec, transactions)).toBe(590);
  });

  it("calcReceivableRemaining: не менше нуля", () => {
    const rec = { amount: 100, linkedTxIds: ["p"] } as never;
    const transactions = [{ id: "p", amount: 500_00 }];
    expect(calcReceivableRemaining(rec, transactions)).toBe(0);
  });

  it("getReceivablePaid рахує лише надходження (amount > 0)", () => {
    const rec = { linkedTxIds: ["a", "b"] } as never;
    const transactions = [
      { id: "a", amount: 300_00 },
      { id: "b", amount: -50_00 },
    ];
    expect(getReceivablePaid(rec, transactions)).toBe(300);
  });

  it("getReceivableOriginated рахує лише витрати (amount < 0)", () => {
    const rec = { linkedTxIds: ["a", "b"] } as never;
    const transactions = [
      { id: "a", amount: -80_00 },
      { id: "b", amount: 20_00 },
    ];
    expect(getReceivableOriginated(rec, transactions)).toBe(80);
  });

  it("getReceivableEffectiveTotal", () => {
    const rec = { amount: 500, linkedTxIds: ["x"] } as never;
    const transactions = [{ id: "x", amount: -100_00 }];
    expect(getReceivableEffectiveTotal(rec, transactions)).toBe(600);
  });

  it("getReceivableTxRole розрізняє виникнення та погашення", () => {
    expect(getReceivableTxRole({ amount: -30 }).kind).toBe("origin");
    expect(getReceivableTxRole({ amount: 100 }).kind).toBe("payment");
  });
});
