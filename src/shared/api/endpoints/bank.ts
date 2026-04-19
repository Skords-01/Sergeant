import { http } from "../httpClient";

/**
 * Endpoint-и для server-side сховища банківських credentials (див.
 * `server/routes/banks.ts` + `server/modules/bankVaultRoutes.ts`).
 *
 * Після збереження через ці методи фронт більше не передає відкритий
 * токен у заголовках `/api/mono`/`/api/privat` — сервер сам дістає його
 * з vault за `user_id` із сесії Better Auth. Статус-endpoint повертає
 * також `vaultAvailable: false`, якщо сервер не сконфігурований з
 * `BANK_TOKEN_ENC_KEY` — фронт у такому разі мовчки залишається на
 * legacy-режимі зі заголовками.
 */

export interface BankStatusResponse {
  mono: boolean;
  privat: boolean;
  vaultAvailable: boolean;
}

export const bankApi = {
  status: () => http.get<BankStatusResponse>("/api/bank/status"),
  saveMono: (token: string) =>
    http.post<{ ok: true }>("/api/bank/mono/token", { token }),
  deleteMono: () =>
    http.del<{ ok: true; removed?: boolean }>("/api/bank/mono/token"),
  savePrivat: (payload: { id: string; token: string }) =>
    http.post<{ ok: true }>("/api/bank/privat/credentials", payload),
  deletePrivat: () =>
    http.del<{ ok: true; removed?: boolean }>("/api/bank/privat/credentials"),
};
