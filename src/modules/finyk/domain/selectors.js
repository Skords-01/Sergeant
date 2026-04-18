import {
  getTxStatAmount,
  getCategory,
  resolveExpenseCategoryMeta,
} from "../utils";

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

function getCatColor(categoryId, customCategories = [], idx = 0) {
  if (CAT_COLORS[categoryId]) return CAT_COLORS[categoryId];
  const custom = Array.isArray(customCategories)
    ? customCategories.find((c) => c.id === categoryId)
    : null;
  if (custom?.color) return custom.color;
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export function getMonthlySummary(
  transactions,
  { excludedTxIds = new Set(), txSplits = {} } = {},
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);
  let spent = 0;
  let income = 0;
  let txCount = 0;

  for (const tx of list) {
    if (!tx || excluded.has(tx.id)) continue;
    txCount++;
    if (tx.amount < 0) spent += getTxStatAmount(tx, txSplits);
    else income += tx.amount / 100;
  }

  spent = Math.round(spent);
  income = Math.round(income);
  return { spent, income, balance: income - spent, txCount };
}

// Heaviest step of category analytics: iterates every expense transaction
// once, resolves a category per tx (or per split) and aggregates spend.
// Shared by `getTopCategories` / `getCategoryDistribution` / hooks so the
// transaction list is scanned at most once per (tx + filters) change.
export function computeCategorySpendIndex(
  transactions,
  {
    txCategories = {},
    txSplits = {},
    customCategories = [],
    excludedTxIds = new Set(),
  } = {},
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);
  const catSpend = {};
  let totalSpent = 0;

  for (const tx of list) {
    if (!tx || excluded.has(tx.id) || tx.amount >= 0) continue;
    const splits = txSplits[tx.id];
    if (splits && splits.length > 0) {
      for (const s of splits) {
        if (!s.categoryId || !s.amount) continue;
        catSpend[s.categoryId] = (catSpend[s.categoryId] || 0) + s.amount;
        totalSpent += s.amount;
      }
    } else {
      const cat = getCategory(
        tx.description,
        tx.mcc,
        txCategories[tx.id],
        customCategories,
      );
      const amt = Math.abs(tx.amount / 100);
      catSpend[cat.id] = (catSpend[cat.id] || 0) + amt;
      totalSpent += amt;
    }
  }

  return { catSpend, totalSpent };
}

// Pure projection of a precomputed spend index into a sorted category list.
// Cheap (O(k log k) on distinct categories), so it can be re-derived
// whenever `customCategories` (labels/colors) change without re-scanning txs.
function buildCategoryList({ catSpend, totalSpent }, customCategories = []) {
  return Object.entries(catSpend)
    .map(([categoryId, rawSpent], idx) => {
      const meta = resolveExpenseCategoryMeta(categoryId, customCategories) || {
        id: categoryId,
        label: "💳 Інше",
      };
      return {
        categoryId,
        label: meta.label,
        spent: Math.round(rawSpent),
        pct: totalSpent > 0 ? Math.round((rawSpent / totalSpent) * 100) : 0,
        color: getCatColor(categoryId, customCategories, idx),
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

// Slice a precomputed category index into top-N entries.
export function selectTopCategoriesFromIndex(
  index,
  customCategories = [],
  limit = 5,
) {
  return buildCategoryList(index, customCategories).slice(0, limit);
}

// Build a full distribution view (up to 20 categories) with pct
// rebased on the displayed slice.
export function selectCategoryDistributionFromIndex(
  index,
  customCategories = [],
) {
  const top = buildCategoryList(index, customCategories).slice(0, 20);
  const totalSpent = top.reduce((s, c) => s + c.spent, 0);
  return top.map((c, idx) => ({
    ...c,
    pct: totalSpent > 0 ? Math.round((c.spent / totalSpent) * 100) : 0,
    color: c.color || getCatColor(c.categoryId, customCategories, idx),
  }));
}

export function getTopCategories(transactions, opts = {}, limit = 5) {
  const index = computeCategorySpendIndex(transactions, opts);
  return selectTopCategoriesFromIndex(
    index,
    opts.customCategories || [],
    limit,
  );
}
