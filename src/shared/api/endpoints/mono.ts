import { http } from "../httpClient";

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

export const monoApi = {
  clientInfo: (token: string, opts?: { signal?: AbortSignal }) =>
    http.get<MonoClientInfo>("/api/mono", {
      query: { path: "/personal/client-info" },
      headers: { "X-Token": token },
      signal: opts?.signal,
    }),
  statement: (
    token: string,
    accId: string,
    from: number,
    to: number,
    opts?: { signal?: AbortSignal },
  ) =>
    http.get<MonoStatementEntry[]>("/api/mono", {
      query: { path: `/personal/statement/${accId}/${from}/${to}` },
      headers: { "X-Token": token },
      signal: opts?.signal,
    }),
};
