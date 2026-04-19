import { INTERNAL_TRANSFER_ID } from "../constants";
import { getCategory } from "./categories.js";

// Ефективна сума транзакції для статистики витрат (враховує спліт).
// Якщо є спліт — сумує лише частини що НЕ є внутрішнім переказом.
export function getTxStatAmount(tx, txSplits = {}) {
  const splits = txSplits[tx.id];
  if (!splits || splits.length === 0) return Math.abs(tx.amount / 100);
  return splits
    .filter((s) => s.categoryId !== INTERNAL_TRANSFER_ID)
    .reduce((s, p) => s + (p.amount || 0), 0);
}

// Сума витрат по категорії. txSplits дозволяє розбити одну транзакцію на декілька категорій.
export function calcCategorySpent(
  txs,
  categoryId,
  txCategories = {},
  txSplits = {},
  customCategories = [],
) {
  return Math.round(
    txs
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => {
        const splits = txSplits[t.id];
        if (splits && splits.length > 0) {
          return (
            sum +
            splits
              .filter((s) => s.categoryId === categoryId)
              .reduce((s, p) => s + (p.amount || 0), 0)
          );
        }
        if (
          getCategory(
            t.description,
            t.mcc,
            txCategories[t.id],
            customCategories,
          ).id === categoryId
        ) {
          return sum + Math.abs(t.amount / 100);
        }
        return sum;
      }, 0),
  );
}
