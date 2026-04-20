import { useQueries } from "@tanstack/react-query";
import {
  monoApi,
  type MonoAccount,
  type MonoStatementEntry,
} from "@shared/api";
import { finykKeys } from "@shared/lib/queryKeys";
import { authAwareRetry } from "@shared/lib/queryClient";
import { CURRENCY } from "../constants";
import { normalizeTransaction, type Transaction } from "../domain/transactions";

/**
 * React Query–backed reader для `/personal/statement/{acc}/{from}/{to}`.
 *
 * Крок 1 міграції `useMonobank.js`: цей хук НЕ підключений до UI —
 * існуючий імперативний `useMonobank.fetchAllTx` лишається основним
 * джерелом даних. Нові сторінки/віджети можуть викликати `useMonoStatements`
 * напряму, не чіпаючи стару реалізацію.
 *
 * Дизайн:
 *  - Один `useQuery` на рахунок (`useQueries` + `combine`). Частковий збій
 *    одного рахунку не валить решту — RQ зберігає `data` для успішних
 *    ключів, поки failed-запити живуть у своєму `error`-стані. Це дає
 *    ту саму "merge-with-previous-if-account-failed" семантику, яку
 *    стара реалізація робила вручну у `mergeTxWithPrevious`.
 *  - Ключ `finykKeys.monoStatement(acc.id, from, to)` місяцю-bucketed:
 *    коли міняється `from/to` (новий місяць), RQ автоматично зробить
 *    новий запит, а стару кеш-лінію GC-не раніше, ніж через `gcTime`.
 *  - Тільки UAH-рахунки, як і у старому `useMonobank`.
 *  - `refetchOnWindowFocus: true` перекриває глобальний `false` — для
 *    банківських рухів це очікувана поведінка.
 *
 * Ретраї: 2 спроби, з експоненційним бекофом; auth-помилки не ретраяться
 * (повтор без нового токена безглуздий).
 */

const STALE_TIME = 60_000;
const GC_TIME = 5 * 60_000;

export interface MonoStatementsRange {
  /** Unix seconds, inclusive. */
  from: number;
  /** Unix seconds, inclusive. */
  to: number;
}

export interface UseMonoStatementsResult {
  /** Нормалізовані транзакції, злиті й відсортовані за спаданням часу. */
  transactions: Transaction[];
  /** Кількість рахунків, за якими є свіжі дані. */
  accountsOk: number;
  /** Загальна кількість цільових рахунків (UAH). */
  accountsTotal: number;
  /** Чи триває fetch хоч одного з per-account запитів. */
  isFetching: boolean;
  /** true, поки жодного рахунку ще не повернулося (initial load). */
  isLoading: boolean;
  /** Перша помилка з усіх per-account запитів; null якщо всі успішні. */
  error: unknown;
  /** `true`, якщо хоч один рахунок завершився помилкою (частковий збій). */
  hasPartialFailure: boolean;
}

function dedupeByIdSort(txs: Transaction[]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of txs) byId.set(t.id, t);
  return Array.from(byId.values()).sort(
    (a, b) => (b.time ?? 0) - (a.time ?? 0),
  );
}

/**
 * Повертає [from, to] у unix-секундах для поточного календарного місяця
 * локального часового поясу.
 *
 * Обидві межі стабільні у межах календарного місяця — це критично, бо
 * `to` йде у React Query key (`finykKeys.monoStatement(acc.id, from, to)`):
 * якби `to` був `Math.floor(Date.now()/1000)`, кожен рендер на іншій
 * секунді давав би новий ключ, ламаючи staleTime/gcTime і провокуючи
 * refetch-шторм. Тому `to` — це початок наступного місяця (0 год).
 *
 * Monobank `/personal/statement/{from}/{to}` приймає `to` у майбутньому
 * і все одно повертає лише транзакції, що вже відбулися — тож
 * end-of-month безпечний.
 */
export function currentMonthRange(now: Date = new Date()): MonoStatementsRange {
  const from = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
  );
  const to = Math.floor(
    new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000,
  );
  return { from, to };
}

export function useMonoStatements(
  token: string | null | undefined,
  accounts: readonly MonoAccount[] | null | undefined,
  range?: MonoStatementsRange,
): UseMonoStatementsResult {
  const tok = (token ?? "").trim();
  const { from, to } = range ?? currentMonthRange();
  const uahAccounts = (accounts ?? []).filter(
    (a) => a?.currencyCode === CURRENCY.UAH,
  );

  return useQueries({
    queries: uahAccounts.map((acc) => ({
      queryKey: finykKeys.monoStatement(acc.id, from, to),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        monoApi.statement(tok, acc.id, from, to, { signal }),
      enabled: Boolean(tok) && Boolean(acc?.id),
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
      refetchOnWindowFocus: true,
      retry: authAwareRetry(2),
      retryDelay: (attempt: number) => 1000 * (attempt + 1),
    })),
    combine: (results): UseMonoStatementsResult => {
      const flat: Transaction[] = [];
      let accountsOk = 0;
      let hasPartialFailure = false;
      let firstError: unknown = null;

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const acc = uahAccounts[i];
        if (r.isSuccess && Array.isArray(r.data)) {
          accountsOk++;
          const items = r.data as MonoStatementEntry[];
          for (const raw of items) {
            flat.push(
              normalizeTransaction(raw, {
                source: "monobank",
                accountId: acc.id,
              }),
            );
          }
        } else if (r.error) {
          hasPartialFailure = true;
          if (!firstError) firstError = r.error;
        }
      }

      return {
        transactions: dedupeByIdSort(flat),
        accountsOk,
        accountsTotal: uahAccounts.length,
        isFetching: results.some((r) => r.isFetching),
        isLoading: uahAccounts.length > 0 && results.every((r) => r.isPending),
        error: firstError,
        hasPartialFailure,
      };
    },
  });
}
