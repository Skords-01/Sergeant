// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getIncomeCategory,
  getCategory,
  fmtAmt,
  fmtDate,
  getAccountLabel,
  getMonoDebt,
  isMonoDebt,
  daysUntil,
  getMonthStart,
  getTxStatAmount,
  calcCategorySpent,
  calcMonthlyNeeded,
  getFinykExcludedTxIdsFromStorage,
  getFinykTxSplitsFromStorage,
  calcFinykSpendingTotal,
  calcFinykSpendingByDate,
  getMonoTotals,
  resolveExpenseCategoryMeta,
} from "./utils.js";
import { INTERNAL_TRANSFER_ID, CURRENCY } from "./constants.js";

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("getIncomeCategory", () => {
  it("повертає категорію за overrideId", () => {
    expect(getIncomeCategory("", "in_salary").id).toBe("in_salary");
    expect(getIncomeCategory("", "in_cashback").id).toBe("in_cashback");
  });
  it("падає назад на in_other коли опису нема та override нема", () => {
    expect(getIncomeCategory("", null).id).toBe("in_other");
  });
  it("знаходить категорію по keywords у описі", () => {
    expect(getIncomeCategory("Зарплата від роботодавця").id).toBe("in_salary");
  });
  it("ігнорує невалідний overrideId і падає на опис/дефолт", () => {
    expect(getIncomeCategory("", "no_such_id").id).toBe("in_other");
  });
});

describe("getCategory (expense)", () => {
  it("маппить відомий MCC на категорію", () => {
    expect(getCategory("", 5411).id).toBe("food");
    expect(getCategory("", 4111).id).toBe("transport");
  });
  it("шукає по keyword в описі", () => {
    expect(getCategory("АТБ №123", 0).id).toBe("food");
    expect(getCategory("Uber поїздка", 0).id).toBe("transport");
  });
  it("override має перевагу над MCC", () => {
    expect(getCategory("", 5411, "transport").id).toBe("transport");
  });
  it("користувацька категорія застосовується через override", () => {
    const custom = [{ id: "custom_1", label: "Моя" }];
    const cat = getCategory("", 0, "custom_1", custom);
    expect(cat.id).toBe("custom_1");
    expect(cat.label).toBe("Моя");
  });
  it("fallback 'other' для невідомого MCC без ключових слів", () => {
    expect(getCategory("щось випадкове", 9999).id).toBe("other");
  });
});

describe("resolveExpenseCategoryMeta", () => {
  it("повертає MCC категорію", () => {
    expect(resolveExpenseCategoryMeta("food").id).toBe("food");
  });
  it("повертає кастомну категорію з переданого списку", () => {
    const r = resolveExpenseCategoryMeta("c_1", [
      { id: "c_1", label: "Підписка на кабельне" },
    ]);
    expect(r.id).toBe("c_1");
    expect(r.label).toBe("Підписка на кабельне");
  });
  it("повертає null для невідомого id", () => {
    expect(resolveExpenseCategoryMeta("ghost")).toBeNull();
  });
});

describe("fmtAmt", () => {
  it("форматує UAH з символом ₴", () => {
    expect(fmtAmt(15000, CURRENCY.UAH)).toContain("₴");
  });
  it("додає + для позитивних і не додає для від'ємних", () => {
    expect(fmtAmt(10000).startsWith("+")).toBe(true);
    expect(fmtAmt(-10000).startsWith("+")).toBe(false);
  });
  it("підтримує USD та EUR символи", () => {
    expect(fmtAmt(10000, CURRENCY.USD)).toContain("$");
    expect(fmtAmt(10000, CURRENCY.EUR || "EUR")).toContain("€");
  });
});

describe("fmtDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });
  it("повертає 'Сьогодні' для сьогоднішнього timestamp", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(fmtDate(nowSec)).toMatch(/^Сьогодні/);
  });
  it("повертає 'Вчора' для учорашнього timestamp", () => {
    const yesterdaySec = Math.floor(Date.now() / 1000) - 86400;
    expect(fmtDate(yesterdaySec)).toMatch(/^Вчора/);
  });
});

describe("getAccountLabel", () => {
  it("повертає спеціальну мітку для єПідтримки", () => {
    expect(getAccountLabel({ type: "eAid" })).toContain("Єпідтримка");
  });
  it("кредитна картка коли ліміт>0 і type=black", () => {
    expect(
      getAccountLabel({ type: "black", creditLimit: 5000, balance: 0 }),
    ).toContain("Кредитна");
  });
  it("кредит коли ліміт>0 і інший type", () => {
    expect(
      getAccountLabel({ type: "white", creditLimit: 5000, balance: 0 }),
    ).toContain("Кредит");
  });
  it("fallback коли нічого не співпадає", () => {
    expect(getAccountLabel({ type: "unknown" })).toContain("Картка");
  });
});

describe("getMonoDebt", () => {
  it("повертає (creditLimit - balance)/100 коли кредитка з балансом нижче ліміту", () => {
    expect(getMonoDebt({ creditLimit: 500000, balance: 200000 })).toBe(3000);
  });
  it("повертає 0 коли баланс дорівнює або перевищує ліміт", () => {
    expect(getMonoDebt({ creditLimit: 500000, balance: 500000 })).toBe(0);
    expect(getMonoDebt({ creditLimit: 500000, balance: 600000 })).toBe(0);
  });
  it("повертає |balance|/100 для некредитки з мінусом", () => {
    expect(getMonoDebt({ creditLimit: 0, balance: -150000 })).toBe(1500);
  });
  it("повертає 0 для некредитки з плюсом", () => {
    expect(getMonoDebt({ creditLimit: 0, balance: 500000 })).toBe(0);
  });
});

describe("isMonoDebt", () => {
  it("true коли є заборгованість по кредитці", () => {
    expect(isMonoDebt({ creditLimit: 500000, balance: 200000 })).toBe(true);
  });
  it("false коли ліміт=0", () => {
    expect(isMonoDebt({ creditLimit: 0, balance: -100000 })).toBe(false);
  });
  it("false коли ліміт вичерпано/погашено", () => {
    expect(isMonoDebt({ creditLimit: 500000, balance: 500000 })).toBe(false);
  });
});

describe("daysUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 10, 12, 0, 0));
  });
  it("повертає додатну кількість днів до дати в поточному місяці", () => {
    expect(daysUntil(20)).toBe(10);
  });
  it("переходить на наступний місяць коли день вже минув", () => {
    expect(daysUntil(5)).toBeGreaterThan(20);
    expect(daysUntil(5)).toBeLessThanOrEqual(31);
  });
});

describe("getMonthStart", () => {
  it("повертає перший день поточного місяця", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
    const start = getMonthStart();
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
    expect(start.getFullYear()).toBe(2024);
  });
});

describe("getTxStatAmount", () => {
  it("без спліту повертає |amount|/100", () => {
    expect(getTxStatAmount({ id: "t1", amount: -12345 })).toBeCloseTo(123.45);
  });
  it("зі сплітом сумує тільки не-internal_transfer частини", () => {
    const splits = {
      t1: [
        { amount: 100, categoryId: "food" },
        { amount: 50, categoryId: INTERNAL_TRANSFER_ID },
        { amount: 25, categoryId: "transport" },
      ],
    };
    expect(getTxStatAmount({ id: "t1", amount: -17500 }, splits)).toBe(125);
  });
  it("0 коли всі сплити — internal_transfer", () => {
    const splits = {
      t1: [{ amount: 100, categoryId: INTERNAL_TRANSFER_ID }],
    };
    expect(getTxStatAmount({ id: "t1", amount: -10000 }, splits)).toBe(0);
  });
});

describe("calcCategorySpent", () => {
  const txs = [
    { id: "1", amount: -50000, mcc: 5411, description: "АТБ" }, // food
    { id: "2", amount: -20000, mcc: 4111, description: "Uber" }, // transport
    { id: "3", amount: 30000, mcc: 5411, description: "refund" }, // income, ignored
    { id: "4", amount: -10000, mcc: 0, description: "АТБ маг" }, // food (keyword)
  ];
  it("сумує витрати для food через MCC+keyword", () => {
    expect(calcCategorySpent(txs, "food")).toBe(600);
  });
  it("сумує через override для окремої транзакції", () => {
    expect(calcCategorySpent(txs, "transport", { "4": "transport" })).toBe(
      300,
    );
  });
  it("використовує спліт коли він заданий", () => {
    const splits = {
      "1": [
        { amount: 200, categoryId: "food" },
        { amount: 300, categoryId: "restaurant" },
      ],
    };
    expect(calcCategorySpent(txs, "food", {}, splits)).toBe(300);
    expect(calcCategorySpent(txs, "restaurant", {}, splits)).toBe(300);
  });
});

describe("calcMonthlyNeeded", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 12, 0, 0)));
  });
  it("isAchieved коли saved >= target", () => {
    const r = calcMonthlyNeeded(1000, 1000, "2024-12-01");
    expect(r.isAchieved).toBe(true);
    expect(r.monthsLeft).toBe(0);
  });
  it("null, null коли немає цільової дати", () => {
    const r = calcMonthlyNeeded(1000, 200, null);
    expect(r.monthlyNeeded).toBeNull();
    expect(r.monthsLeft).toBeNull();
  });
  it("isOverdue коли дата в минулому і не досягнуто", () => {
    const r = calcMonthlyNeeded(1000, 200, "2024-01-01");
    expect(r.isOverdue).toBe(true);
  });
  it("обчислює monthlyNeeded для майбутньої дати", () => {
    const r = calcMonthlyNeeded(1200, 0, "2024-12-15");
    expect(r.monthlyNeeded).toBeGreaterThan(0);
    expect(r.monthsLeft).toBeGreaterThanOrEqual(5);
    expect(r.monthlyNeeded * r.monthsLeft).toBeGreaterThanOrEqual(1200);
  });
});

describe("getFinykExcludedTxIdsFromStorage", () => {
  it("повертає пустий Set коли localStorage порожній", () => {
    const s = getFinykExcludedTxIdsFromStorage();
    expect(s).toBeInstanceOf(Set);
    expect(s.size).toBe(0);
  });
  it("об'єднує hidden + internal_transfer + recv.linkedTxIds + extra", () => {
    localStorage.setItem("finyk_hidden_txs", JSON.stringify(["a"]));
    localStorage.setItem(
      "finyk_tx_cats",
      JSON.stringify({ b: INTERNAL_TRANSFER_ID, c: "food" }),
    );
    localStorage.setItem(
      "finyk_recv",
      JSON.stringify([{ linkedTxIds: ["d", "e"] }]),
    );
    localStorage.setItem("finyk_excluded_stat_txs", JSON.stringify(["f"]));
    const s = getFinykExcludedTxIdsFromStorage();
    expect(s.has("a")).toBe(true);
    expect(s.has("b")).toBe(true);
    expect(s.has("c")).toBe(false);
    expect(s.has("d")).toBe(true);
    expect(s.has("e")).toBe(true);
    expect(s.has("f")).toBe(true);
  });
});

describe("getFinykTxSplitsFromStorage", () => {
  it("повертає {} коли немає даних", () => {
    expect(getFinykTxSplitsFromStorage()).toEqual({});
  });
  it("повертає збережений об'єкт", () => {
    localStorage.setItem(
      "finyk_tx_splits",
      JSON.stringify({ t1: [{ amount: 10, categoryId: "food" }] }),
    );
    const v = getFinykTxSplitsFromStorage();
    expect(v.t1).toHaveLength(1);
  });
  it("повертає {} коли значення — не об'єкт", () => {
    localStorage.setItem("finyk_tx_splits", JSON.stringify("string"));
    expect(getFinykTxSplitsFromStorage()).toEqual({});
  });
});

describe("calcFinykSpendingTotal", () => {
  const txs = [
    { id: "1", amount: -50000 },
    { id: "2", amount: -20000 },
    { id: "3", amount: 30000 },
    { id: "4", amount: -10000 },
  ];
  it("сумує всі витрати коли немає excluded", () => {
    expect(calcFinykSpendingTotal(txs)).toBe(800);
  });
  it("ігнорує tx з excluded Set", () => {
    expect(
      calcFinykSpendingTotal(txs, { excludedTxIds: new Set(["1"]) }),
    ).toBe(300);
  });
  it("приймає excluded як масив", () => {
    expect(calcFinykSpendingTotal(txs, { excludedTxIds: ["1", "2"] })).toBe(
      100,
    );
  });
  it("ігнорує позитивні суми (це доходи)", () => {
    const positives = [{ id: "p", amount: 99999 }];
    expect(calcFinykSpendingTotal(positives)).toBe(0);
  });
  it("повертає 0 для не-масиву на вході", () => {
    expect(calcFinykSpendingTotal(null)).toBe(0);
    expect(calcFinykSpendingTotal(undefined)).toBe(0);
  });
  it("враховує txSplits (виключає internal transfer)", () => {
    const splits = {
      "1": [
        { amount: 200, categoryId: "food" },
        { amount: 300, categoryId: INTERNAL_TRANSFER_ID },
      ],
    };
    const one = [{ id: "1", amount: -50000 }];
    expect(calcFinykSpendingTotal(one, { txSplits: splits })).toBe(200);
  });
});

describe("calcFinykSpendingByDate", () => {
  it("агрегує витрати по днях і узгоджує total з сумою округлених daily", () => {
    const dateSet = new Set(["2024-06-01", "2024-06-02"]);
    const localDateKeyFn = (d) => {
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${d.getUTCFullYear()}-${m}-${day}`;
    };
    const tsJun1 = Math.floor(Date.UTC(2024, 5, 1, 10, 0, 0) / 1000);
    const tsJun2 = Math.floor(Date.UTC(2024, 5, 2, 10, 0, 0) / 1000);
    const txs = [
      { id: "a", amount: -10045, time: tsJun1 },
      { id: "b", amount: -20055, time: tsJun2 },
      { id: "c", amount: -9999, time: tsJun2 },
      { id: "d", amount: 55555, time: tsJun1 }, // positive, ignored
    ];
    const res = calcFinykSpendingByDate(txs, {
      dateSet,
      localDateKeyFn,
    });
    expect(res).toHaveProperty("total");
    expect(res).toHaveProperty("daily");
    const sumDaily = Object.values(res.daily).reduce((s, v) => s + v, 0);
    expect(res.total).toBe(sumDaily);
  });
});

describe("getMonoTotals", () => {
  it("сумує балансі та борги по видимих рахунках", () => {
    const accounts = [
      {
        id: "a1",
        type: "white",
        balance: 100000,
        creditLimit: 0,
        currencyCode: CURRENCY.UAH,
      },
      {
        id: "a2",
        type: "black",
        balance: -50000,
        creditLimit: 0,
        currencyCode: CURRENCY.UAH,
      },
      {
        id: "a3",
        type: "black",
        balance: 200000,
        creditLimit: 500000,
        currencyCode: CURRENCY.UAH,
      },
    ];
    const res = getMonoTotals(accounts, []);
    expect(res).toHaveProperty("balance");
    expect(res).toHaveProperty("debt");
    expect(res.balance).toBe(1000);
    expect(res.debt).toBe(3000);
  });
  it("пропускає приховані рахунки", () => {
    const accounts = [
      {
        id: "a1",
        type: "white",
        balance: 100000,
        creditLimit: 0,
        currencyCode: CURRENCY.UAH,
      },
      {
        id: "a2",
        type: "white",
        balance: 200000,
        creditLimit: 0,
        currencyCode: CURRENCY.UAH,
      },
    ];
    const visible = getMonoTotals(accounts, []);
    const hidden = getMonoTotals(accounts, ["a2"]);
    expect(hidden.balance).toBeLessThan(visible.balance);
  });
});
