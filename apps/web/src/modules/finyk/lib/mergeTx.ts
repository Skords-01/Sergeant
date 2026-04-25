import type { Transaction } from "@sergeant/finyk-domain/domain/types";

/**
 * Об'єднує дві колекції транзакцій по `id`. Дані з `current` мають пріоритет
 * (свіжіша версія від API перекриває стару зі snapshot-у), але всі id, які
 * були у `previous` і відсутні у `current` — зберігаються. Сортуємо за
 * спаданням `time`, щоб UI отримував уже готовий до показу список.
 *
 * Використовується у `useMonobank.ts` для злиття часткових даних від
 * `useMonoStatements` із кешованим snapshot-ом, коли частина рахунків не
 * повернула відповідь (rate-limit Monobank, тимчасова мережна помилка).
 * Без цього злиття UI показував би лише транзакції успішних рахунків, а
 * snapshot перетирався меншим набором — звідси симптом «залишилось
 * декілька транзакцій за весь місяць».
 */
export function mergeTxByIdDesc(
  current: readonly Transaction[],
  previous: readonly Transaction[],
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of previous) byId.set(t.id, t);
  for (const t of current) byId.set(t.id, t);
  return Array.from(byId.values()).sort(
    (a, b) => (b.time ?? 0) - (a.time ?? 0),
  );
}
