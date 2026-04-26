import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseLocalDate,
  getNextBillingDate,
  formatRelativeDue,
  startOfToday,
  computeFinykSchedule,
} from "./upcomingSchedule";
import { CURRENCY } from "@sergeant/finyk-domain/constants";

describe("parseLocalDate", () => {
  it("парсить ISO-дату без часового поясу", () => {
    const d = parseLocalDate("2025-03-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it("повертає fallback для null/undefined/порожнього рядка", () => {
    expect(parseLocalDate(null).getFullYear()).toBeGreaterThan(0);
    expect(parseLocalDate(undefined).getFullYear()).toBeGreaterThan(0);
    expect(parseLocalDate("").getFullYear()).toBeGreaterThan(0);
  });
});

describe("getNextBillingDate", () => {
  it("повертає дату в поточному місяці, якщо ще не настала", () => {
    const now = new Date(2025, 5, 10); // June 10
    const d = getNextBillingDate(20, now);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(20);
  });

  it("переходить на наступний місяць, якщо день вже пройшов", () => {
    const now = new Date(2025, 5, 25); // June 25
    const d = getNextBillingDate(10, now);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(10);
  });

  it("обрізає billingDay до останнього дня місяця (лютий)", () => {
    const now = new Date(2025, 1, 1); // Feb 1
    const d = getNextBillingDate(31, now);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });
});

describe("formatRelativeDue", () => {
  const today = new Date(2025, 5, 15); // June 15

  it("'сьогодні' якщо та сама дата", () => {
    expect(formatRelativeDue(new Date(2025, 5, 15), today)).toBe("сьогодні");
  });

  it("'завтра' якщо наступний день", () => {
    expect(formatRelativeDue(new Date(2025, 5, 16), today)).toBe("завтра");
  });

  it("'через N дн' якщо до 7 днів", () => {
    expect(formatRelativeDue(new Date(2025, 5, 18), today)).toBe("через 3 дн");
  });

  it("коротка дата якщо більше тижня", () => {
    const result = formatRelativeDue(new Date(2025, 5, 30), today);
    expect(result).toContain("30");
  });
});

describe("computeFinykSchedule — paid current cycle", () => {
  // Фіксуємо `todayStart` на 26 квітня (день списання).
  const todayStart = new Date(2026, 3, 26);

  function makeSub(linkedTxId = "tx-today") {
    return {
      id: "sub-gpt",
      name: "ChatGPT Plus",
      billingDay: 26,
      linkedTxId,
      currency: "UAH",
    };
  }

  it("переносить `nextCharge` на наступний місяць, якщо привʼязана транзакція припадає на сьогодні", () => {
    const tx = {
      id: "tx-today",
      amount: -101694,
      time: new Date(2026, 3, 26, 12, 37).getTime(),
      currencyCode: CURRENCY.UAH,
    };
    const { nextCharge } = computeFinykSchedule({
      subscriptions: [makeSub()],
      manualDebts: [],
      receivables: [],
      transactions: [tx],
      todayStart,
    });
    expect(nextCharge).not.toBeNull();
    expect(nextCharge?.dueDate.getMonth()).toBe(4); // травень
    expect(nextCharge?.dueDate.getDate()).toBe(26);
  });

  it("не переносить, якщо остання транзакція з минулого циклу", () => {
    const tx = {
      id: "tx-prev",
      amount: -101694,
      time: new Date(2026, 2, 26, 12, 0).getTime(), // 26 березня
      currencyCode: CURRENCY.UAH,
    };
    const { nextCharge } = computeFinykSchedule({
      subscriptions: [makeSub("tx-prev")],
      manualDebts: [],
      receivables: [],
      transactions: [tx],
      todayStart,
    });
    expect(nextCharge?.dueDate.getMonth()).toBe(3); // квітень (сьогодні)
    expect(nextCharge?.dueDate.getDate()).toBe(26);
  });
});

describe("startOfToday", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("повертає опівночі поточного дня", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 14, 30, 0));
    const d = startOfToday();
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(15);
  });
});
