import { describe, it, expect, vi } from "vitest";

/**
 * Auth-конфіг не потребує реального Postgres для цього тесту — ми
 * перевіряємо тільки статичну конфігурацію (наявність плагінів, basePath,
 * emailAndPassword). DB-pool мокається на рівні модуля, тож
 * `betterAuth({ database: pool })` отримує stub без мережі.
 */
vi.mock("./db.js", () => {
  const pool = {
    query: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };
  return { default: pool, pool, query: pool.query, ensureSchema: vi.fn() };
});

const { auth } = await import("./auth.js");

describe("auth config — bearer plugin інтегрований у Better Auth", () => {
  /**
   * Мобільний Capacitor-shell ходить по Authorization: Bearer, а не
   * cookie. Без `bearer()` плагіна сервер не резолвитиме сесію з header-а
   * і shell буде розлогінений на кожен cold start — щось, що ми свідомо
   * виправляємо у цьому PR. Якщо хтось прибере плагін — тест кричить.
   */
  it("плагін з id='bearer' зареєстрований у options.plugins", () => {
    const options = (auth as unknown as { options: { plugins?: unknown[] } })
      .options;
    const plugins = Array.isArray(options.plugins) ? options.plugins : [];
    const ids = plugins
      .map((p) => (p as { id?: unknown }).id)
      .filter((id): id is string => typeof id === "string");
    expect(ids).toContain("bearer");
  });

  /**
   * Захист від випадкової зміни префіксу: `/api/auth` зашитий у
   * `apps/web/src/shared/lib/apiUrl.ts` (виняток у версіонуванні) і у
   * `apps/server/src/routes/auth.ts` (router path). Якщо basePath
   * зʼїде — веб/mobile-shell одразу побачать 404 на всіх auth-ендпоінтах.
   */
  it("basePath лишається '/api/auth'", () => {
    const options = (auth as unknown as { options: { basePath?: string } })
      .options;
    expect(options.basePath).toBe("/api/auth");
  });

  it("emailAndPassword увімкнений (ми не працюємо в OAuth-only режимі)", () => {
    const options = (
      auth as unknown as {
        options: { emailAndPassword?: { enabled?: boolean } };
      }
    ).options;
    expect(options.emailAndPassword?.enabled).toBe(true);
  });

  it("налаштовані sendResetPassword та emailVerification (Resend у рантаймі)", () => {
    const options = (
      auth as unknown as {
        options: {
          emailAndPassword?: { sendResetPassword?: unknown };
          emailVerification?: { sendVerificationEmail?: unknown };
        };
      }
    ).options;
    expect(typeof options.emailAndPassword?.sendResetPassword).toBe("function");
    expect(typeof options.emailVerification?.sendVerificationEmail).toBe(
      "function",
    );
  });
});
