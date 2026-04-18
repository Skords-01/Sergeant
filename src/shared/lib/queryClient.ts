/**
 * Shared QueryClient for @tanstack/react-query.
 *
 * Defaults tuned for a PWA that often works offline:
 *  - retry only for transient network errors (not for 4xx);
 *  - `staleTime` 60s — агресивне повторне використання кешу для вкладок,
 *    що часто ре-маунтяться (модалки, переходи між Hub і модулями);
 *  - `gcTime` 5хв — тримаємо дані в пам'яті після того, як
 *    останній observer відписався, але не надовго, щоб не тримати
 *    застарілі дані після логауту.
 *
 * Мутації не ретраяться — серверні AI-ендпоінти дорогі, не хочемо
 * повторювати випадково.
 */

import { QueryClient } from "@tanstack/react-query";

interface MaybeHttpError {
  status?: number;
  response?: { status?: number };
}

function isRetriableError(error: unknown): boolean {
  if (!error) return false;
  const e = error as MaybeHttpError;
  const status = e?.status ?? e?.response?.status;
  if (typeof status === "number") {
    // 408 Request Timeout, 429 Too Many Requests, 5xx
    return status === 408 || status === 429 || status >= 500;
  }
  // Мережеві помилки (TypeError: Failed to fetch, AbortError і т.ін.)
  return true;
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          return isRetriableError(error);
        },
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
