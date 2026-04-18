import { http } from "../httpClient";
import type { QueryValue } from "../types";

export interface PrivatCredentials {
  merchantId: string;
  merchantToken: string;
}

/**
 * Шейпи відповідей з Privatbank corporate API (через проксі `/api/privat`).
 * Див. https://docs.api.privatbank.ua/#/
 *
 * Усі числові поля повертаються як рядки (`"0.00"`) — це особливість
 * Privat-API, не баг типізації.
 */

export interface PrivatBalanceRecord {
  acc: string;
  currency: string;
  balanceIn?: string;
  balanceInEq?: string;
  balanceOut?: string;
  balanceOutEq?: string;
  turnoverDebt?: string;
  turnoverDebtEq?: string;
  turnoverCred?: string;
  turnoverCredEq?: string;
  bgfIBrnm?: string;
  brnm?: string;
  dpd?: string;
  nameACC?: string;
  flmt?: string;
  atp?: string;
  type?: string;
  flags?: string;
}

export interface PrivatBalanceFinalResponse {
  status?: string;
  balances?: PrivatBalanceRecord[];
  exist_next_page?: boolean;
  next_page_id?: string;
}

export interface PrivatStatementEntry {
  AUT_MY_ACC: string;
  AUT_MY_CRF: string;
  AUT_MY_MFO: string;
  AUT_MY_NAM: string;
  AUT_CNTR_ACC: string;
  AUT_CNTR_CRF: string;
  AUT_CNTR_MFO: string;
  AUT_CNTR_NAM: string;
  CCY: string;
  DAT_KL: string;
  DAT_OD: string;
  REF: string;
  ID?: string;
  PR_PR: string;
  SUM?: string;
  SUM_E?: string;
  OSND?: string;
  [key: string]: unknown;
}

export interface PrivatStatementsResponse {
  status?: string;
  transactions?: PrivatStatementEntry[];
  exist_next_page?: boolean;
  next_page_id?: string;
}

/**
 * Усі виклики до Privatbank ідуть через наш проксі `/api/privat?path=…`
 * і передають `X-Privat-Id` / `X-Privat-Token` у заголовках.
 */
export const privatApi = {
  request: <T = unknown>(
    creds: PrivatCredentials,
    path: string,
    query?: Record<string, QueryValue>,
    opts?: { signal?: AbortSignal },
  ) =>
    http.get<T>("/api/privat", {
      query: { path, ...(query ?? {}) },
      headers: {
        "X-Privat-Id": creds.merchantId,
        "X-Privat-Token": creds.merchantToken,
      },
      signal: opts?.signal,
    }),
  balanceFinal: (creds: PrivatCredentials, opts?: { signal?: AbortSignal }) =>
    privatApi.request<PrivatBalanceFinalResponse>(
      creds,
      "/statements/balance/final",
      { country: "UA", showRest: "true" },
      opts,
    ),
};
