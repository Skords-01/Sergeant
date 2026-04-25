import { ApiError, isApiError } from "../ApiError";
import type { HttpClient } from "../httpClient";

/**
 * Опис полів береться з Monobank Personal API:
 * https://api.monobank.ua/docs/personal.html
 *
 * Index-signature `[key: string]: unknown` залишений як safety-net: зовнішнє
 * API періодично додає нові поля, і ми не хочемо ламати типізацію на цьому.
 */

export type MonoCashbackType = "" | "None" | "UAH" | "Miles" | string;

// ── Webhook migration DTOs (Track A) ─────────────────────────────────────

export type MonoConnectionStatus =
  | "pending"
  | "active"
  | "invalid"
  | "disconnected";

export interface MonoAccountDto {
  userId: string;
  monoAccountId: string;
  sendId: string | null;
  type: string | null;
  currencyCode: number;
  cashbackType: string | null;
  maskedPan: string[];
  iban: string | null;
  balance: number | null;
  creditLimit: number | null;
  lastSeenAt: string;
}

export interface MonoTransactionDto {
  userId: string;
  monoAccountId: string;
  monoTxId: string;
  time: string;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  mcc: number | null;
  originalMcc: number | null;
  hold: boolean | null;
  description: string | null;
  comment: string | null;
  cashbackAmount: number | null;
  commissionRate: number | null;
  balance: number | null;
  receiptId: string | null;
  invoiceId: string | null;
  counterEdrpou: string | null;
  counterIban: string | null;
  counterName: string | null;
  source: "webhook" | "backfill";
  receivedAt: string;
}

export interface MonoSyncState {
  status: MonoConnectionStatus;
  webhookActive: boolean;
  lastEventAt: string | null;
  lastBackfillAt: string | null;
  accountsCount: number;
}

/**
 * Cursor-paginated response from `GET /api/mono/transactions`. Server returns
 * up to `limit` items (default 50) ordered by `(time DESC, monoTxId DESC)`;
 * `nextCursor` is non-null when more rows are available.
 */
export interface MonoTransactionsPage {
  data: MonoTransactionDto[];
  nextCursor: string | null;
}

export interface MonoAccount {
  id: string;
  sendId?: string;
  currencyCode?: number;
  cashbackType?: MonoCashbackType;
  balance?: number;
  creditLimit?: number;
  maskedPan?: string[];
  type?: string;
  iban?: string;
  [key: string]: unknown;
}

export interface MonoJar {
  id: string;
  sendId?: string;
  title?: string;
  description?: string;
  currencyCode?: number;
  balance?: number;
  goal?: number;
  [key: string]: unknown;
}

export interface MonoClientInfo {
  clientId?: string;
  name?: string;
  webHookUrl?: string;
  permissions?: string;
  accounts?: MonoAccount[];
  jars?: MonoJar[];
  [key: string]: unknown;
}

export interface MonoStatementEntry {
  id: string;
  time: number;
  description: string;
  mcc: number;
  originalMcc?: number;
  hold?: boolean;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate?: number;
  cashbackAmount?: number;
  balance?: number;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
  [key: string]: unknown;
}

export interface MonoEndpoints {
  clientInfo: (
    token: string,
    opts?: { signal?: AbortSignal },
  ) => Promise<MonoClientInfo>;
  statement: (
    token: string,
    accId: string,
    from: number,
    to: number,
    opts?: { signal?: AbortSignal },
  ) => Promise<MonoStatementEntry[]>;
}

/**
 * Monobank Personal API обмежує `/personal/statement/{acc}/{from}/{to}` 500
 * транзакціями за запит — повертає останні 500 у діапазоні у зворотному
 * хронологічному порядку. Активні користувачі з >500 tx/міс мовчки отримували
 * обрізану виписку. Пагінуємо тут: запит за сторінкою (from, prevTo), далі
 * зсуваємо `prevTo := min(time) - 1` і повторюємо, поки сторінка повна.
 *
 * Safety cap — 20 сторінок (~10 000 tx) — практично неосяжно навіть для
 * бізнес-акаунтів, і стримує rate-limit (1 req/60 s/per token) від
 * нескінченного циклу при зламаному API.
 */
const MONO_STATEMENT_PAGE_SIZE = 500;
const MONO_STATEMENT_MAX_PAGES = 20;
/**
 * Monobank Personal обмежує `/personal/statement` rate-limit-ом 1 req/60 s/per
 * token. У payload-ах з >500 tx (pagination додано після #585) другий page
 * раніше падав з `ApiError status=429` і всю виписку ми втрачали. Тепер при
 * 429 з `Retry-After` чекаємо стільки, скільки сервер попросив (capped 65s,
 * бо більше за 60s Monobank не потребує), і робимо до 2 ретраїв на сторінку.
 * `maxTotalMs` — жорстка межа, щоб у зламаному API не заклинити loop на
 * годину.
 */
const MONO_RETRY_MAX_DELAY_MS = 65_000;
const MONO_RETRY_MAX_PER_PAGE = 2;

type Sleeper = (ms: number) => Promise<void>;
const defaultSleep: Sleeper = (ms) => new Promise((r) => setTimeout(r, ms));
let _sleep: Sleeper = defaultSleep;
/**
 * Test-only hook: підміняє `setTimeout`-sleep на детермінований proxy. Без
 * нього `vitest`-тест на 429-ретрай чекав би реальні 65 s. Не експортуй у
 * прод-коді.
 */
export function __setMonoSleep(fn: Sleeper | null): void {
  _sleep = fn ?? defaultSleep;
}

export function createMonoEndpoints(http: HttpClient): MonoEndpoints {
  const fetchStatementPageOnce = (
    token: string,
    accId: string,
    from: number,
    to: number,
    signal?: AbortSignal,
  ) =>
    http.get<MonoStatementEntry[]>("/api/mono", {
      query: { path: `/personal/statement/${accId}/${from}/${to}` },
      headers: { "X-Token": token },
      signal,
    });

  const fetchStatementPage = async (
    token: string,
    accId: string,
    from: number,
    to: number,
    signal?: AbortSignal,
  ): Promise<MonoStatementEntry[]> => {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= MONO_RETRY_MAX_PER_PAGE) {
      try {
        return await fetchStatementPageOnce(token, accId, from, to, signal);
      } catch (err) {
        lastErr = err;
        if (
          !isApiError(err) ||
          err.status !== 429 ||
          attempt >= MONO_RETRY_MAX_PER_PAGE
        ) {
          throw err;
        }
        // Без `retryAfterMs` від сервера не гадаємо навмання — прокидуємо
        // 429 наверх. Активний rate-limit без retry-after — сигнал змінити
        // upstream конфіг, а не сліпо ретраїти.
        const waitMs = err.retryAfterMs;
        if (!waitMs) throw err;
        const safeWait = Math.min(waitMs, MONO_RETRY_MAX_DELAY_MS);
        await _sleep(safeWait);
        attempt += 1;
      }
    }
    // Недосяжно: цикл повертає результат або викидає ще у catch-гілці.
    /* c8 ignore next */
    throw lastErr instanceof ApiError
      ? lastErr
      : new Error("mono.statement: exhausted retries");
  };

  return {
    clientInfo: (token, opts) =>
      http.get<MonoClientInfo>("/api/mono", {
        query: { path: "/personal/client-info" },
        headers: { "X-Token": token },
        signal: opts?.signal,
      }),
    statement: async (token, accId, from, to, opts) => {
      const all: MonoStatementEntry[] = [];
      const seen = new Set<string>();
      let pageTo = to;
      for (let page = 0; page < MONO_STATEMENT_MAX_PAGES; page++) {
        const rows = await fetchStatementPage(
          token,
          accId,
          from,
          pageTo,
          opts?.signal,
        );
        if (!Array.isArray(rows) || rows.length === 0) break;
        let oldest = Number.POSITIVE_INFINITY;
        for (const r of rows) {
          if (r?.id && !seen.has(r.id)) {
            seen.add(r.id);
            all.push(r);
          }
          if (typeof r?.time === "number" && r.time < oldest) oldest = r.time;
        }
        if (rows.length < MONO_STATEMENT_PAGE_SIZE) break;
        if (!Number.isFinite(oldest)) break;
        // Зсуваємо `to` на секунду раніше за найстарішу tx поточної сторінки,
        // щоб Mono повернуло наступну «порцію» без перекриття (seen-Set усе одно
        // страхує, якщо кілька tx поділяють ту саму секунду).
        const nextTo = oldest - 1;
        if (nextTo <= from) break;
        pageTo = nextTo;
      }
      return all;
    },
  };
}

// ── Webhook-based API facade (Track A) ───────────────────────────────────

export interface MonoWebhookEndpoints {
  connect: (
    token: string,
    opts?: { signal?: AbortSignal },
  ) => Promise<{ status: MonoConnectionStatus; accountsCount: number }>;
  disconnect: (opts?: { signal?: AbortSignal }) => Promise<void>;
  syncState: (opts?: { signal?: AbortSignal }) => Promise<MonoSyncState>;
  accounts: (opts?: { signal?: AbortSignal }) => Promise<MonoAccountDto[]>;
  transactions: (
    params: {
      from?: string;
      to?: string;
      accountId?: string;
      limit?: number;
      cursor?: string;
    },
    opts?: { signal?: AbortSignal },
  ) => Promise<MonoTransactionsPage>;
  backfill: (opts?: { signal?: AbortSignal }) => Promise<void>;
}

export function createMonoWebhookEndpoints(
  http: HttpClient,
): MonoWebhookEndpoints {
  return {
    connect: (token, opts) =>
      http.post<{ status: MonoConnectionStatus; accountsCount: number }>(
        "/api/mono/connect",
        { token },
        { signal: opts?.signal },
      ),
    disconnect: (opts) =>
      http.post<void>("/api/mono/disconnect", undefined, {
        signal: opts?.signal,
      }),
    syncState: (opts) =>
      http.get<MonoSyncState>("/api/mono/sync-state", {
        signal: opts?.signal,
      }),
    accounts: (opts) =>
      http.get<MonoAccountDto[]>("/api/mono/accounts", {
        signal: opts?.signal,
      }),
    transactions: (params, opts) =>
      http.get<MonoTransactionsPage>("/api/mono/transactions", {
        query: params,
        signal: opts?.signal,
      }),
    backfill: (opts) =>
      http.post<void>("/api/mono/backfill", undefined, {
        signal: opts?.signal,
      }),
  };
}
