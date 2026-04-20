import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { monoApi, type MonoClientInfo } from "@shared/api";
import { finykKeys, hashToken } from "@shared/lib/queryKeys";
import { authAwareRetry } from "@shared/lib/queryClient";

/**
 * React Query–backed `monoApi.clientInfo` reader.
 *
 * Частина поетапної міграції `useMonobank.js` → React Query (крок 1).
 * Самостійно НЕ підключена до жодного call-site — існуючий `useMonobank`
 * продовжує обслуговувати сторінки Finyk без змін. Цей хук лиш додає
 * паралельний, cache-shared канал читання, до якого наступні PR будуть
 * поступово переводити споживачів (Overview → Transactions → Analytics →
 * Budgets).
 *
 * Ключ `finykKeys.monoClientInfo(hashToken(token))` вже задекларований у
 * `@shared/lib/queryKeys.ts`; токен хешується, щоб не витікати в devtools
 * та в кеш-лінії. `refetchOnWindowFocus: true` свідомо перекриває
 * глобальний дефолт (`false`), бо для банківських read-only даних
 * користувач очікує "відкрив таб — побачив свіже".
 *
 * Ретраї:
 *  - auth-помилки (401/403) не ретраяться — новий токен не з'явиться сам;
 *  - решта HTTP/network помилок — один повтор через 1с (далі вже не
 *    допомагає, а затягує loading-стан).
 */

// client-info міняється рідко — держимо свіжість 10хв, у пам'яті 1год.
const STALE_TIME = 10 * 60_000;
const GC_TIME = 60 * 60_000;

export function useMonoClientInfo(
  token: string | null | undefined,
): UseQueryResult<MonoClientInfo> {
  const tok = (token ?? "").trim();
  return useQuery({
    queryKey: finykKeys.monoClientInfo(hashToken(tok)),
    queryFn: ({ signal }) => monoApi.clientInfo(tok, { signal }),
    enabled: Boolean(tok),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: true,
    retry: authAwareRetry(1),
  });
}
