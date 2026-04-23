import type { HttpClient } from "../httpClient";

/**
 * Опис полів береться з Monobank Personal API:
 * https://api.monobank.ua/docs/personal.html
 *
 * Index-signature `[key: string]: unknown` залишений як safety-net: зовнішнє
 * API періодично додає нові поля, і ми не хочемо ламати типізацію на цьому.
 */

export type MonoCashbackType = "" | "None" | "UAH" | "Miles" | string;

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

export function createMonoEndpoints(http: HttpClient): MonoEndpoints {
  const fetchStatementPage = (
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
