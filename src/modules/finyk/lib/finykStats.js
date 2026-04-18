import { normalizeTransaction } from "../domain/transactions";
import {
  getMonthlySummary,
  getTopCategories,
  getCategoryDistribution,
  getTrendComparison,
  getTopMerchants,
  computeCategorySpendIndex,
  selectCategoryDistributionFromIndex,
} from "../domain/selectors";

const CAT_COLORS = {
  food: "#10b981",
  restaurant: "#f59e0b",
  transport: "#3b82f6",
  subscriptions: "#8b5cf6",
  health: "#ec4899",
  shopping: "#f97316",
  entertainment: "#14b8a6",
  sport: "#22c55e",
  beauty: "#e879f9",
  smoking: "#78716c",
  education: "#6366f1",
  travel: "#0ea5e9",
  debt: "#ef4444",
  charity: "#84cc16",
  utilities: "#64748b",
  other: "#94a3b8",
};

const FALLBACK_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
  "#8b5cf6",
  "#22c55e",
  "#e879f9",
];

export function getCatColor(categoryId, customCategories = [], idx = 0) {
  if (CAT_COLORS[categoryId]) return CAT_COLORS[categoryId];
  const custom = Array.isArray(customCategories)
    ? customCategories.find((c) => c.id === categoryId)
    : null;
  if (custom?.color) return custom.color;
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export {
  getMonthlySummary,
  getTopCategories,
  getCategoryDistribution,
  getTrendComparison,
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

  const normalizedManual = manual.map((e) =>
    normalizeTransaction(
      {
        id: `manual_${e.id}`,
        time: e.date ? Math.floor(new Date(e.date).getTime() / 1000) : 0,
        amount: -(Math.abs(e.amount) * 100),
        description: e.description || "",
        mcc: 0,
        raw: { category: e.category },
      },
      { source: "manual", accountId: null },
    ),
  );

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
