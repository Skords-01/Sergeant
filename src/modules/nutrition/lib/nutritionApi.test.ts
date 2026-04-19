import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError, isApiError } from "@shared/api";
import { postJson } from "./nutritionApi";

// Мокаємо централізований `nutritionApi` з `@shared/api`: під час
// імпорту `./nutritionApi` адаптер підтягує саме цей мок. Використовуємо
// `vi.hoisted` для мок-функції, бо `vi.mock` піднімається вище імпортів.
const { postJsonMock } = vi.hoisted(() => ({ postJsonMock: vi.fn() }));
vi.mock("@shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/api")>();
  return {
    ...actual,
    nutritionApi: {
      postJson: (url: string, body: unknown) => postJsonMock(url, body),
    },
  };
});

const URL = "/api/nutrition/day-plan";

describe("nutritionApi adapter postJson", () => {
  beforeEach(() => {
    postJsonMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("пробрасує успішний response", async () => {
    const payload = { plan: "ok" };
    postJsonMock.mockResolvedValueOnce(payload);
    await expect(postJson(URL, { weekKey: "2025-01-01" })).resolves.toEqual(
      payload,
    );
    expect(postJsonMock).toHaveBeenCalledWith(URL, { weekKey: "2025-01-01" });
  });

  it("HTTP 500 → ApiError (kind=http) з юзер-френдлі повідомленням і збереженим status/body", async () => {
    const src = new ApiError({
      kind: "http",
      message: "HTTP 500",
      status: 500,
      body: { error: "server exploded" },
      bodyText: '{"error":"server exploded"}',
      url: URL,
    });
    postJsonMock.mockRejectedValueOnce(src);

    const err = await postJson(URL, {}).catch((e: unknown) => e);
    expect(isApiError(err)).toBe(true);
    const apiErr = err as ApiError;
    expect(apiErr.kind).toBe("http");
    expect(apiErr.status).toBe(500);
    expect(apiErr.message).toBe("server exploded");
    expect(apiErr.body).toEqual({ error: "server exploded" });
    expect(apiErr.serverMessage).toBe("server exploded");
    expect(apiErr.url).toBe(URL);
    expect(apiErr.cause).toBe(src);
  });

  it("HTTP 500 без ключа AI → nutrition-специфічний текст", async () => {
    postJsonMock.mockRejectedValueOnce(
      new ApiError({
        kind: "http",
        message: "HTTP 500",
        status: 500,
        body: { error: "ANTHROPIC_API_KEY not set" },
        url: URL,
      }),
    );
    const err = (await postJson(URL, {}).catch((e: unknown) => e)) as ApiError;
    expect(err.message).toBe(
      "Сервер харчування не налаштовано (немає ключа AI).",
    );
    expect(err.status).toBe(500);
    expect(err.kind).toBe("http");
  });

  it("HTTP 413 → nutrition-специфічний текст про фото", async () => {
    postJsonMock.mockRejectedValueOnce(
      new ApiError({
        kind: "http",
        message: "HTTP 413",
        status: 413,
        body: { error: "Payload Too Large" },
        url: URL,
      }),
    );
    const err = (await postJson(URL, {}).catch((e: unknown) => e)) as ApiError;
    expect(err.message).toBe(
      "Занадто велике фото. Стисни/обріж і спробуй ще раз.",
    );
    expect(err.status).toBe(413);
  });

  it("kind=network + navigator.onLine=false → офлайн-текст, kind зберігається", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    postJsonMock.mockRejectedValueOnce(
      new ApiError({
        kind: "network",
        message: "Failed to fetch",
        url: URL,
      }),
    );
    const err = (await postJson(URL, {}).catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe("network");
    expect(err.status).toBe(0);
    expect(err.message).toBe(
      "Немає підключення до інтернету. Спробуй пізніше.",
    );
  });

  it("kind=parse + HTML body → текст про rewrite; bodyText зберігається", async () => {
    postJsonMock.mockRejectedValueOnce(
      new ApiError({
        kind: "parse",
        message: "Unexpected token <",
        // eslint-disable-next-line sergeant-design/no-ellipsis-dots -- literal HTML fixture, not user-facing copy
        bodyText: "<!doctype html><html>...</html>",
        url: URL,
      }),
    );
    const err = (await postJson(URL, {}).catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe("parse");
    expect(err.message).toBe(
      "API повернув HTML замість JSON (ймовірно, rewrite перехоплює /api/*).",
    );
    // eslint-disable-next-line sergeant-design/no-ellipsis-dots -- literal HTML fixture, not user-facing copy
    expect(err.bodyText).toBe("<!doctype html><html>...</html>");
  });

  it("не-ApiError (plain Error) → огортається в ApiError(kind=network) з .cause", async () => {
    const raw = new Error("unexpected explosion");
    postJsonMock.mockRejectedValueOnce(raw);
    const err = (await postJson(URL, {}).catch((e: unknown) => e)) as ApiError;
    expect(isApiError(err)).toBe(true);
    expect(err.kind).toBe("network");
    expect(err.message).toBe("unexpected explosion");
    expect(err.url).toBe(URL);
    expect(err.cause).toBe(raw);
  });

  it("HTTP 429 → загальний текст про rate-limit", async () => {
    postJsonMock.mockRejectedValueOnce(
      new ApiError({
        kind: "http",
        message: "HTTP 429",
        status: 429,
        body: { error: "Too Many Requests" },
        url: URL,
      }),
    );
    const err = (await postJson(URL, {}).catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(429);
    expect(err.message).toBe("Забагато запитів. Спробуй через хвилину.");
  });
});
