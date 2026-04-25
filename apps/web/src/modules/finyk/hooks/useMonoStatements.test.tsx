// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@shared/api";
import { CURRENCY } from "../constants";

vi.mock("@shared/api", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/api")>("@shared/api");
  return {
    ...actual,
    monoApi: {
      clientInfo: vi.fn(),
      statement: vi.fn(),
    },
  };
});

import { monoApi } from "@shared/api";
import {
  useMonoStatements,
  currentMonthRange,
  enqueueStatementCall,
  __resetMonoStatementQueues,
} from "./useMonoStatements";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const mockedStatement = monoApi.statement as unknown as ReturnType<
  typeof vi.fn
>;

const UAH = CURRENCY.UAH;

function makeAcc(id: string, currencyCode: number = UAH) {
  return { id, currencyCode };
}

const RANGE = { from: 1_700_000_000, to: 1_700_500_000 };

describe("useMonoStatements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMonoStatementQueues();
  });

  it("нічого не фетчить, поки немає токена або рахунків", async () => {
    const { result } = renderHook(
      () => useMonoStatements("", [makeAcc("a1")], RANGE),
      { wrapper: makeWrapper() },
    );
    expect(result.current.accountsTotal).toBe(1);
    expect(result.current.transactions).toEqual([]);
    expect(mockedStatement).not.toHaveBeenCalled();
  });

  it("фільтрує non-UAH акаунти", async () => {
    mockedStatement.mockResolvedValue([]);
    const accounts = [
      makeAcc("uah1", UAH),
      makeAcc("usd1", 840),
      makeAcc("eur1", 978),
    ];
    const { result } = renderHook(
      () => useMonoStatements("TOKEN", accounts, RANGE),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.accountsTotal).toBe(1);
    expect(mockedStatement).toHaveBeenCalledTimes(1);
    expect(mockedStatement).toHaveBeenCalledWith(
      "TOKEN",
      "uah1",
      RANGE.from,
      RANGE.to,
      expect.any(Object),
    );
  });

  it("зливає транзакції з усіх UAH-рахунків, дедупить і сортує за часом", async () => {
    mockedStatement
      .mockResolvedValueOnce([
        { id: "tx1", time: 100, amount: -1000 },
        { id: "tx2", time: 300, amount: -2500 },
      ])
      .mockResolvedValueOnce([
        { id: "tx2", time: 300, amount: -2500 }, // дубль (має зникнути)
        { id: "tx3", time: 200, amount: -500 },
      ]);

    const accounts = [makeAcc("a1"), makeAcc("a2")];
    const { result } = renderHook(
      () => useMonoStatements("TOKEN", accounts, RANGE),
      { wrapper: makeWrapper() },
    );

    await waitFor(() =>
      expect(result.current.transactions.length).toBeGreaterThan(0),
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    const ids = result.current.transactions.map((t) => t.id);
    expect(ids).toEqual(["tx2", "tx3", "tx1"]);
    expect(result.current.accountsOk).toBe(2);
    expect(result.current.accountsTotal).toBe(2);
    expect(result.current.hasPartialFailure).toBe(false);
  });

  it("повертає часткові дані при збої одного рахунку", async () => {
    // Ключуємо по accountId — інакше ретраї (hook робить 2 спроби)
    // з'їли б нашу `mockRejectedValueOnce` і друга спроба повернула б undefined.
    mockedStatement.mockImplementation(
      async (_token: string, accId: string) => {
        if (accId === "a1") return [{ id: "tx1", time: 100, amount: -1000 }];
        throw new ApiError({
          kind: "http",
          status: 500,
          message: "boom",
          url: "/api/mono",
        });
      },
    );

    const accounts = [makeAcc("a1"), makeAcc("a2")];
    const { result } = renderHook(
      () => useMonoStatements("TOKEN", accounts, RANGE),
      { wrapper: makeWrapper() },
    );

    // hook retries transient (non-auth) HTTP помилки з 1s+2s бекофом —
    // тож чекаємо довше, поки RQ не вичерпає спроби й не осяде у error-стані.
    await waitFor(() => expect(result.current.isFetching).toBe(false), {
      timeout: 6000,
    });

    expect(result.current.accountsOk).toBe(1);
    expect(result.current.accountsTotal).toBe(2);
    expect(result.current.hasPartialFailure).toBe(true);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBe("tx1");
  });

  it("currentMonthRange повертає [початок місяця, початок наступного) у секундах", () => {
    const now = new Date(2025, 3, 15, 12, 0, 0); // 15 квітня 12:00
    const { from, to } = currentMonthRange(now);
    expect(from).toBe(Math.floor(new Date(2025, 3, 1).getTime() / 1000));
    // Межа `to` — початок травня; стабільна у межах квітня.
    expect(to).toBe(Math.floor(new Date(2025, 4, 1).getTime() / 1000));
    expect(to).toBeGreaterThan(from);
  });

  it("currentMonthRange стабільний у межах місяця — ключ кешу не тече", () => {
    // Два різні моменти одного календарного місяця повинні давати
    // ідентичний діапазон, інакше `finykKeys.monoStatement(..., from, to)`
    // змінюватиметься щосекунди і зламає staleTime/gcTime.
    const a = currentMonthRange(new Date(2025, 3, 1, 0, 0, 1));
    const b = currentMonthRange(new Date(2025, 3, 30, 23, 59, 59));
    expect(a).toEqual(b);
  });

  it("currentMonthRange коректно перемикається через грудень-січень", () => {
    const r = currentMonthRange(new Date(2025, 11, 20, 10, 0, 0));
    expect(r.from).toBe(Math.floor(new Date(2025, 11, 1).getTime() / 1000));
    expect(r.to).toBe(Math.floor(new Date(2026, 0, 1).getTime() / 1000));
  });

  it("серіалізує statement-запити по токену: другий старт лише після завершення першого", async () => {
    // Регресія: Monobank `/personal/statement` rate-limit-ить 1 req/60s/token.
    // Раніше `useQueries` з кількома UAH-рахунками стартував усі запити
    // паралельно, що гарантовано спричиняло 429 на 2-3-му рахунку.
    // Тепер `enqueueStatementCall` серіалізує per-token, тож наступний
    // mock-виклик не має навіть стартувати, поки попередній не зарезолвився.
    let resolveFirst: (() => void) | null = null;
    let secondStarted = false;

    mockedStatement.mockImplementation(async (_t: string, accId: string) => {
      if (accId === "a1") {
        await new Promise<void>((res) => {
          resolveFirst = res;
        });
        return [{ id: "tx1", time: 100, amount: -1000 }];
      }
      // a2 не повинен стартувати, поки a1 у польоті
      secondStarted = true;
      return [{ id: "tx2", time: 200, amount: -500 }];
    });

    const accounts = [makeAcc("a1"), makeAcc("a2")];
    const { result } = renderHook(
      () => useMonoStatements("TOKEN", accounts, RANGE),
      { wrapper: makeWrapper() },
    );

    // Дамо мікротаскам відпрацювати, але першу проміс не резолвимо.
    await new Promise((r) => setTimeout(r, 50));
    expect(secondStarted).toBe(false);
    expect(mockedStatement).toHaveBeenCalledTimes(1);

    // Розблоковуємо першу — друга має піти у роботу.
    resolveFirst?.();

    await waitFor(() => expect(result.current.accountsOk).toBe(2));
    expect(secondStarted).toBe(true);
    expect(mockedStatement).toHaveBeenCalledTimes(2);
  });

  it("enqueueStatementCall: помилка одного запиту не блокує наступний у тій самій черзі", async () => {
    // Якби ми не робили `.catch(() => undefined)` у chain-у — `prev.then(fn)`
    // закидав би причину далі і всі майбутні enqueue по цьому токену
    // ламались би. Перевіряємо: rejection не псує чергу.
    const order: string[] = [];
    const p1 = enqueueStatementCall("T", async () => {
      order.push("a-start");
      throw new Error("boom");
    }).catch(() => "swallowed");
    const p2 = enqueueStatementCall("T", async () => {
      order.push("b-start");
      return "ok";
    });
    await Promise.all([p1, p2]);
    expect(order).toEqual(["a-start", "b-start"]);
    await expect(p2).resolves.toBe("ok");
  });
});
