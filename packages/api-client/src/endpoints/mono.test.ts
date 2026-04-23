// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHttpClient } from "../httpClient";
import { createMonoEndpoints, __setMonoSleep } from "./mono";
import type { MonoStatementEntry } from "./mono";
import { isApiError } from "../ApiError";

type FetchMock = ReturnType<typeof vi.fn>;

let originalFetch: typeof fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  __setMonoSleep(null);
  vi.restoreAllMocks();
});

function mkEntry(id: string, time: number): MonoStatementEntry {
  return {
    id,
    time,
    description: "",
    mcc: 0,
    amount: 0,
    operationAmount: 0,
    currencyCode: 980,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("createMonoEndpoints.statement — 429 retry з Retry-After", () => {
  it("чекає `Retry-After` (seconds) і повторює запит", async () => {
    // Регресія: після пагінації (PR #585) Monobank на другій сторінці видає
    // 429 з `Retry-After: 60`. Без targeted retry — крашила вся виписка.
    const sleepMock = vi.fn(async () => {});
    __setMonoSleep(sleepMock);

    const fetchMock: FetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // 1. page1 — 500 tx (повна сторінка → pagination просить наступну)
    const page1 = Array.from({ length: 500 }, (_, i) =>
      mkEntry(`id-${i}`, 1_700_000_000 - i),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(page1));
    // 2. page2 — 429 з Retry-After; ретрай через 45s
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Занадто багато запитів" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "45",
        },
      }),
    );
    // 3. page2 (retry) — 10 tx
    const page2 = [mkEntry("id-1000", 1_699_999_000)];
    fetchMock.mockResolvedValueOnce(jsonResponse(page2));

    const mono = createMonoEndpoints(createHttpClient());
    const res = await mono.statement(
      "tok",
      "acc",
      1_000_000_000,
      2_000_000_000,
    );

    expect(res).toHaveLength(501);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(45_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("capає Retry-After до 65s навіть якщо сервер дає більше", async () => {
    // Захист від помилки конфігурації Monobank / misconfigured upstream:
    // без cap-у клієнт міг би застрягти на годину.
    const sleepMock = vi.fn(async () => {});
    __setMonoSleep(sleepMock);

    const fetchMock: FetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "x" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "600",
        },
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const mono = createMonoEndpoints(createHttpClient());
    await mono.statement("tok", "acc", 1, 2);

    expect(sleepMock).toHaveBeenCalledWith(65_000);
  });

  it("не ретраїть 429 без Retry-After — пробрасує ApiError", async () => {
    // Без явного retry-hint від сервера сліпий retry може погіршити ситуацію
    // (нові 429 + метрики, що вводять в оману). Hard-fail з видимим ApiError.
    const sleepMock = vi.fn(async () => {});
    __setMonoSleep(sleepMock);

    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "rate" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mono = createMonoEndpoints(createHttpClient());
    const p = mono.statement("tok", "acc", 1, 2);

    await expect(p).rejects.toSatisfy((e: unknown) => {
      return isApiError(e) && e.status === 429 && e.retryAfterMs === undefined;
    });
    expect(sleepMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("здається після MAX_RETRY_PER_PAGE спроб — захист від засинання loop-а", async () => {
    // Якщо upstream постійно повертає 429, не хочемо крутити loop вічно.
    const sleepMock = vi.fn(async () => {});
    __setMonoSleep(sleepMock);

    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "rate" }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "5",
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mono = createMonoEndpoints(createHttpClient());
    await expect(mono.statement("tok", "acc", 1, 2)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.status === 429,
    );
    // 1 first try + 2 retries = 3 fetches
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });
});
