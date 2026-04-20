// Web-обгортка над чистим фінансовим контекстом з `@sergeant/insights`.
// Читає `localStorage` один раз і готує похідні дані (canonical-id сумарні,
// множини transferIds тощо), щоб окремі правила не дублювали парсинг.
//
// Навмисно — тут не використовується typedStore: існуючі LS-ключі читаються
// у старому форматі, а міграція — окрема фіча (див. `migrateFinykStorage`).
// Правила (у пакеті `@sergeant/insights`) платформо-незалежні; цей файл —
// єдина точка, де контекст «запікається» з Web-LS.

import { getCategory } from "../../../modules/finyk/utils";
import { manualCategoryToCanonicalId } from "../../../modules/finyk/domain/personalization";
import { Recommendations } from "@sergeant/insights";

type FinanceContext = Recommendations.FinanceContext;
type Transaction = Recommendations.Transaction;
type ManualExpense = Recommendations.ManualExpense;
type Budget = Recommendations.Budget;
type CustomCategory = Recommendations.CustomCategory;

// Реекспортуємо тип для консумерів у web, щоб шлях імпорту лишався знайомим.
export type { FinanceContext };
// Реекспортуємо helper для консумерів у web (історично жив тут).
export const txTimestamp = Recommendations.txTimestamp;

function safeLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function buildFinanceContext(): FinanceContext {
  const now = new Date();
  const monthStart = startOfCurrentMonth();
  const monthStartMs = monthStart.getTime();

  const txCache = safeLS<{ txs?: Transaction[] } | Transaction[] | null>(
    "finyk_tx_cache",
    null,
  );
  const transactions: Transaction[] = Array.isArray(txCache)
    ? txCache
    : (txCache?.txs ?? []);

  const budgets = safeLS<Budget[]>("finyk_budgets", []);
  const txCategories = safeLS<Record<string, string>>("finyk_tx_cats", {});
  const customCategories = safeLS<CustomCategory[]>("finyk_custom_cats_v1", []);
  const hiddenTxIds = new Set(safeLS<string[]>("finyk_hidden_txs", []));
  const transferIds = new Set(
    Object.entries(txCategories)
      .filter(([, v]) => v === "internal_transfer")
      .map(([k]) => k),
  );
  const manualExpenses = safeLS<ManualExpense[]>(
    "finyk_manual_expenses_v1",
    [],
  );

  const thisMonthTx = transactions.filter((tx) => {
    if (hiddenTxIds.has(tx.id)) return false;
    if (transferIds.has(tx.id)) return false;
    return txTimestamp(tx) >= monthStartMs;
  });

  // Legacy categorySpend (raw keys) — залишаємо для сумісності з існуючими
  // правилами budget_over/budget_warn, які працюють з raw `txCategories` /
  // manual labels. Це ЯВНА тимчасова двоякість — див. canonicalMonthSpend.
  const categorySpend: Record<string, number> = {};
  for (const tx of thisMonthTx) {
    if ((tx.amount ?? 0) >= 0) continue;
    const catId = txCategories[tx.id] || "other";
    categorySpend[catId] =
      (categorySpend[catId] || 0) + Math.abs(tx.amount / 100);
  }
  for (const me of manualExpenses) {
    const ts = new Date(me.date).getTime();
    if (ts < monthStartMs) continue;
    const catId = me.category || "other";
    categorySpend[catId] = (categorySpend[catId] || 0) + Math.abs(me.amount);
  }

  // Canonical-id сумарні — для правил, що оперують МСС-резолвом.
  const canonicalMonthSpend = new Map<string, number>();
  const canonicalTotalCount = new Map<string, number>();
  for (const tx of transactions) {
    if (hiddenTxIds.has(tx.id) || transferIds.has(tx.id)) continue;
    if ((tx.amount ?? 0) >= 0) continue;
    const override = txCategories[tx.id] || null;
    const cat = getCategory(
      tx.description || "",
      tx.mcc || 0,
      override,
      customCategories,
    );
    const catId = cat?.id;
    if (!catId || catId === "internal_transfer") continue;
    canonicalTotalCount.set(catId, (canonicalTotalCount.get(catId) || 0) + 1);
    if (txTimestamp(tx) >= monthStartMs) {
      canonicalMonthSpend.set(
        catId,
        (canonicalMonthSpend.get(catId) || 0) + Math.abs(tx.amount / 100),
      );
    }
  }
  for (const me of manualExpenses) {
    const key = manualCategoryToCanonicalId(me.category) || "other";
    if (key === "internal_transfer") continue;
    canonicalTotalCount.set(key, (canonicalTotalCount.get(key) || 0) + 1);
    if (new Date(me.date).getTime() >= monthStartMs) {
      canonicalMonthSpend.set(
        key,
        (canonicalMonthSpend.get(key) || 0) + Math.abs(Number(me.amount) || 0),
      );
    }
  }

  const limits = budgets.filter((b) => b.type === "limit");

  return {
    now,
    monthStart,
    transactions,
    manualExpenses,
    budgets,
    limits,
    txCategories,
    customCategories,
    hiddenTxIds,
    transferIds,
    thisMonthTx,
    categorySpend,
    canonicalMonthSpend,
    canonicalTotalCount,
  };
}
