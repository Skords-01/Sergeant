// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHttpClient } from "./httpClient";
import { ApiError } from "./ApiError";

// Test fixture — minimal client that uses default fetch and relative URLs,
// matching the legacy `http` module export so the assertions below stay
// untouched. Real consumers (apps/web/src/shared/api) build their own client
// via `createApiClient({ baseUrl: apiUrl("") })`.
const http = createHttpClient();
const request = http.request;

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetchOnce(res: Response | Error | DOMException): FetchMock {
  const fn = vi.fn(async () => {
    if (res instanceof Response) return res;
    throw res;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function textResponse(text: string, init: ResponseInit = {}): Response {
  return new Response(text, {
    status: 200,
    headers: { "content-type": "text/html" },
    ...init,
  });
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("httpClient — успішні запити", () => {
  it("GET: парсить JSON і повертає тіло", async () => {
    mockFetchOnce(jsonResponse({ hello: "world" }));
    const data = await http.get<{ hello: string }>("/api/ping");
    expect(data).toEqual({ hello: "world" });
  });

  it("за замовчуванням credentials: 'include' та Accept: application/json", async () => {
    const fn = mockFetchOnce(jsonResponse({ ok: true }));
    await http.get("/api/ping");
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("POST: автоматично серіалізує plain-обʼєкт і ставить Content-Type", async () => {
    const fn = mockFetchOnce(jsonResponse({ ok: true }));
    await http.post("/api/x", { a: 1 });
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("мерджить кастомні заголовки поверх дефолтів (X-Token)", async () => {
    const fn = mockFetchOnce(jsonResponse({ ok: true }));
    await http.get("/api/mono", { headers: { "X-Token": "secret" } });
    const headers = (fn.mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get("X-Token")).toBe("secret");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("додає query-параметри до URL", async () => {
    const fn = mockFetchOnce(jsonResponse({ ok: true }));
    await http.get("/api/search", {
      query: { q: "hello world", limit: 10, skip: undefined },
    });
    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain("q=hello+world");
    expect(url).toContain("limit=10");
    expect(url).not.toContain("skip=");
  });

  it("для FormData не встановлює Content-Type і не серіалізує", async () => {
    const fn = mockFetchOnce(jsonResponse({ ok: true }));
    const fd = new FormData();
    fd.append("file", new Blob(["x"]), "f.txt");
    await http.post("/api/upload", fd);
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(fd);
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("parse: 'raw' повертає Response без читання body", async () => {
    const res = jsonResponse({ should: "not-be-read" });
    mockFetchOnce(res);
    const out = await http.raw("/api/stream");
    expect(out).toBe(res);
    expect(out.bodyUsed).toBe(false);
  });

  it("parse: 'text' повертає сирий текст", async () => {
    mockFetchOnce(textResponse("<!doctype html><html></html>"));
    const out = await request<string>("/api/x", { parse: "text" });
    expect(out).toContain("<html>");
  });

  it("повертає null для порожнього тіла на 2xx", async () => {
    mockFetchOnce(new Response(null, { status: 204 }));
    const out = await http.get("/api/noop");
    expect(out).toBeNull();
  });
});

describe("httpClient — помилки", () => {
  it("HTTP-помилка: ApiError.kind='http', .status, .serverMessage", async () => {
    mockFetchOnce(jsonResponse({ error: "bad thing" }, { status: 400 }));
    await expect(http.get("/api/x")).rejects.toMatchObject({
      name: "ApiError",
      kind: "http",
      status: 400,
      serverMessage: "bad thing",
    });
  });

  it("HTTP-помилка без JSON-body: message = 'HTTP N'", async () => {
    mockFetchOnce(new Response("boom", { status: 500 }));
    const err = await http.get("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toBe("HTTP 500");
    expect((err as ApiError).bodyText).toBe("boom");
  });

  it("network-помилка: ApiError.kind='network', status=0", async () => {
    mockFetchOnce(new TypeError("failed to fetch"));
    const err = await http.get("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("network");
    expect((err as ApiError).status).toBe(0);
  });

  it("abort-помилка: ApiError.kind='aborted'", async () => {
    const abortErr = new DOMException("aborted", "AbortError");
    mockFetchOnce(abortErr);
    const err = await http.get("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("aborted");
  });

  it("HTML замість JSON на 2xx → ApiError.kind='parse', bodyText збережено", async () => {
    mockFetchOnce(textResponse("<!doctype html><html></html>"));
    const err = await http.get("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("parse");
    expect((err as ApiError).bodyText).toContain("<html>");
  });

  it("isAuth для 401/403 HTTP-помилки", async () => {
    mockFetchOnce(jsonResponse({ error: "forbidden" }, { status: 403 }));
    const err = await http.get("/api/x").catch((e: unknown) => e);
    expect((err as ApiError).isAuth).toBe(true);
  });
});

describe("httpClient — AbortSignal", () => {
  it("прокидає signal у fetch", async () => {
    const fn = mockFetchOnce(jsonResponse({ ok: true }));
    const ac = new AbortController();
    await http.get("/api/x", { signal: ac.signal });
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
  });

  it("timeoutMs кидає aborted-помилку", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const e = new DOMException("aborted", "AbortError");
            reject(e);
          });
        }),
    ) as unknown as typeof fetch;
    const caught = http
      .get("/api/slow", { timeoutMs: 50 })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    const err = await caught;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("aborted");
    vi.useRealTimers();
  });
});
