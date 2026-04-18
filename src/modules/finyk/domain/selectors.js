// Pure analytics selectors for the Finyk module.
// Every function here is a pure projection from the passed-in data —
// no `localStorage`, no `window`, no side effects — so it is safe to
// wrap in `useMemo` or call from tests.
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

// Turn a "YYYY-MM" string or a {year, month} object into a predicate
// that matches a tx's local calendar month. Returns null when no month
// filter is requested — callers should treat null as "include all".
function buildMonthPredicate(month) {
  if (!month) return null;
  let y;
  let m;
  if (typeof month === "string") {
    const [ys, ms] = month.split("-");
    y = Number(ys);
    m = Number(ms);
  } else if (typeof month === "object") {
    y = Number(month.year);
    m = Number(month.month);
  }
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return (tx) => {
    if (!tx || !tx.time) return false;
    const ts = tx.time > 1e10 ? tx.time : tx.time * 1000;
    const d = new Date(ts);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  };
}

// Normalize the optional filter bag so selectors can accept either a
// plain options object or a shorthand month string as their second arg.
function normalizeOpts(optsOrMonth) {
  if (optsOrMonth == null) return {};
  if (typeof optsOrMonth === "string") return { month: optsOrMonth };
  return optsOrMonth;
}

// Aggregated totals for a list of transactions (optionally scoped to
// a single calendar month). Pure — never touches storage.
export function getMonthlySummary(transactions, optsOrMonth) {
  const opts = normalizeOpts(optsOrMonth);
  const { excludedTxIds = new Set(), txSplits = {}, month = null } = opts;
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);
  const inMonth = buildMonthPredicate(month);
  let spent = 0;
  let income = 0;
  let txCount = 0;

  for (const tx of list) {
    if (!tx || excluded.has(tx.id)) continue;
    if (inMonth && !inMonth(tx)) continue;
    txCount++;
    if (tx.amount < 0) spent += getTxStatAmount(tx, txSplits);
    else income += tx.amount / 100;
  }

  spent = Math.round(spent);
  income = Math.round(income);
  // `spent`/`income` keep backwards compatibility with existing callers,
  // `totalExpense`/`totalIncome` expose the same numbers under the
  // public selector contract.
  return {
    spent,
    income,
    balance: income - spent,
    txCount,
    totalExpense: spent,
    totalIncome: income,
  };
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
    month = null,
  } = {},
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);
  const inMonth = buildMonthPredicate(month);
  const catSpend = {};
  let totalSpent = 0;

  for (const tx of list) {
    if (!tx || excluded.has(tx.id) || tx.amount >= 0) continue;
    if (inMonth && !inMonth(tx)) continue;
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

// Top spending categories. Supports both the documented selector shape
// `getTopCategories(txs, limit)` and the legacy `(txs, opts, limit)` form
// used by older hooks/tests.
export function getTopCategories(transactions, optsOrLimit = {}, maybeLimit) {
  let opts = {};
  let limit = 5;
  if (typeof optsOrLimit === "number") {
    limit = optsOrLimit;
  } else {
    opts = optsOrLimit || {};
    if (typeof maybeLimit === "number") limit = maybeLimit;
  }
  const index = computeCategorySpendIndex(transactions, opts);
  return selectTopCategoriesFromIndex(
    index,
    opts.customCategories || [],
    limit,
  );
}

// Full `category → amount` distribution (returned as a sorted array of
// `{ categoryId, label, spent, pct, color }`).
export function getCategoryDistribution(transactions, opts = {}) {
  const index = computeCategorySpendIndex(transactions, opts);
  return selectCategoryDistributionFromIndex(
    index,
    opts.customCategories || [],
  );
}

// Compare two monthly summaries and return the absolute and percentage
// delta for both spend and income.
export function getTrendComparison(currentMonthTx, previousMonthTx, opts = {}) {
  const { excludedTxIds = new Set(), txSplits = {} } = opts;
  const curr = getMonthlySummary(currentMonthTx, { excludedTxIds, txSplits });
  const prev = getMonthlySummary(previousMonthTx, { excludedTxIds, txSplits });
  const diff = curr.spent - prev.spent;
  const diffPct = prev.spent > 0 ? Math.round((diff / prev.spent) * 100) : null;
  const incomeDiff = curr.income - prev.income;
  const incomeDiffPct =
    prev.income > 0 ? Math.round((incomeDiff / prev.income) * 100) : null;

  return {
    currentSpent: curr.spent,
    prevSpent: prev.spent,
    diff,
    diffPct,
    currentIncome: curr.income,
    prevIncome: prev.income,
    incomeDiff,
    incomeDiffPct,
  };
}

// Top merchants by aggregated expense. Deterministic, pure sort — useful
// both in the UI and in tests.
export function getTopMerchants(transactions, opts = {}, maybeLimit) {
  const {
    excludedTxIds = new Set(),
    month = null,
    limit: optsLimit,
  } = typeof opts === "number" ? { limit: opts } : opts || {};
  const limit = typeof maybeLimit === "number" ? maybeLimit : (optsLimit ?? 10);
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);
  const inMonth = buildMonthPredicate(month);
  const merchants = {};

  for (const tx of list) {
    if (!tx || excluded.has(tx.id) || tx.amount >= 0) continue;
    if (inMonth && !inMonth(tx)) continue;
    const name = (tx.description || "").trim();
    if (!name) continue;
    if (!merchants[name]) merchants[name] = { name, count: 0, total: 0 };
    merchants[name].count++;
    merchants[name].total += Math.abs(tx.amount / 100);
  }

  return Object.values(merchants)
    .map((m) => ({ ...m, total: Math.round(m.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
