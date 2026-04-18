import { manualExpenseToTransaction } from "../domain/transactions";
import { getCatColor } from "../domain/categories";
import {
  getMonthlySummary,
  getTopCategories,
  getCategoryDistribution,
  getTrendComparison,
  getCurrentVsPreviousComparison,
  formatComparisonSummary,
  getTopMerchants,
  computeCategorySpendIndex,
  selectCategoryDistributionFromIndex,
} from "../domain/selectors";

// Кольори категорій — єдине джерело правди в `domain/categories`.
export { getCatColor };

export {
  getMonthlySummary,
  getTopCategories,
  getCategoryDistribution,
  getTrendComparison,
  getCurrentVsPreviousComparison,
  formatComparisonSummary,
  getTopMerchants,
  computeCategorySpendIndex,
  selectCategoryDistributionFromIndex,
};
export { selectTopCategoriesFromIndex } from "../domain/selectors";

// Legacy alias — retained so existing imports keep working while callers
// migrate to the shorter `getTrendComparison` name.
export const getMonthlyTrendComparison = getTrendComparison;

export function getRecentTransactions(
  transactions,
  { manualExpenses = [], excludedTxIds = new Set() } = {},
  limit = 5,
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const manual = Array.isArray(manualExpenses) ? manualExpenses : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);

  const normalizedManual = manual.map((e) => manualExpenseToTransaction(e));

  const all = [
    ...list.filter((tx) => tx && !excluded.has(tx.id)),
    ...normalizedManual,
  ].sort((a, b) => (b.time || 0) - (a.time || 0));

  return all.slice(0, limit);
}

export function getMonthlySpendSeries(monthlyData) {
  if (!Array.isArray(monthlyData)) return [];
  return monthlyData.map(({ month, transactions, excludedTxIds, txSplits }) => {
    const txList = Array.isArray(transactions) ? transactions : [];
    const excluded = excludedTxIds instanceof Set ? excludedTxIds : new Set();
    const { spent, income } = getMonthlySummary(txList, {
      excludedTxIds: excluded,
      txSplits: txSplits || {},
    });
    const [year, mon] = (month || "").split("-");
    const label =
      year && mon
        ? new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString(
            "uk-UA",
            { month: "short" },
          )
        : month;
    return { month, label, spent, income };
  });
}
