import {
  getTxStatAmount,
  type TxSplitsLike,
  type SpendingTxLike,
} from "./transactions.js";

interface Tx extends SpendingTxLike {
  time?: number;
}

interface SpendingOptions {
  excludedTxIds?: Set<string> | string[];
  txSplits?: TxSplitsLike;
}

interface SpendingByDateOptions extends SpendingOptions {
  dateSet: Set<string>;
  localDateKeyFn: (date: Date) => string;
}

/**
 * Сумарні витрати ФІНІК за списком транзакцій, з урахуванням excludedTxIds та
 * txSplits (через getTxStatAmount). Ця функція — єдине джерело правди для
 * підрахунку spent у Overview, Звітах та інших місцях. Повертає float — округлення
 * виконується викликачем при виводі.
 */
export function calcFinykSpendingTotal(
  transactions: Tx[],
  { excludedTxIds, txSplits = {} }: SpendingOptions = {},
): number {
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set
      ? excludedTxIds
      : new Set(Array.isArray(excludedTxIds) ? excludedTxIds : []);
  let total = 0;
  for (const tx of list) {
    if (!tx || excluded.has(tx.id)) continue;
    if (!(tx.amount < 0)) continue;
    const amt = getTxStatAmount(tx, txSplits);
    if (Number.isFinite(amt) && amt > 0) total += amt;
  }
  return total;
}

/**
 * Підсумовує витрати ФІНІК у заданому діапазоні дат за тими ж правилами, що й
 * Overview. Повертає {total, daily}, причому total = сума округлених daily —
 * це гарантує, що сума стовпчиків на графіку дорівнює числу в картці.
 */
export function calcFinykSpendingByDate(
  transactions: Tx[],
  {
    excludedTxIds,
    txSplits = {},
    dateSet,
    localDateKeyFn,
  }: SpendingByDateOptions,
): { total: number; daily: Record<string, number> } {
  const daily: Record<string, number> = {};
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set
      ? excludedTxIds
      : new Set(Array.isArray(excludedTxIds) ? excludedTxIds : []);

  for (const tx of list) {
    if (!tx || excluded.has(tx.id)) continue;
    if (!(tx.amount < 0)) continue;
    const ts = (tx.time ?? 0) > 1e10 ? (tx.time ?? 0) : (tx.time ?? 0) * 1000;
    const dk = localDateKeyFn(new Date(ts));
    if (!dateSet.has(dk)) continue;
    const amt = getTxStatAmount(tx, txSplits);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    daily[dk] = (daily[dk] || 0) + amt;
  }

  const dailyRounded: Record<string, number> = {};
  let total = 0;
  for (const k of Object.keys(daily)) {
    const r = Math.round(daily[k]);
    dailyRounded[k] = r;
    total += r;
  }
  return { total, daily: dailyRounded };
}
