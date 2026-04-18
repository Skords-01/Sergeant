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
  "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9",
  "#f97316", "#14b8a6", "#8b5cf6", "#22c55e", "#e879f9",
];

export function getCatColor(categoryId, customCategories = [], idx = 0) {
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
    if (tx.amount < 0) {
      spent += getTxStatAmount(tx, txSplits);
    } else {
      income += tx.amount / 100;
    }
  }

  spent = Math.round(spent);
  income = Math.round(income);
  return { spent, income, balance: income - spent, txCount };
}

export function getTopCategories(
  transactions,
  {
    txCategories = {},
    txSplits = {},
    customCategories = [],
    excludedTxIds = new Set(),
  } = {},
  limit = 5,
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

  const sorted = Object.entries(catSpend)
    .map(([categoryId, rawSpent], idx) => {
      const meta = resolveExpenseCategoryMeta(categoryId, customCategories) || {
        id: categoryId,
        label: "💳 Інше",
      };
      return {
        categoryId,
        label: meta.label,
        spent: Math.round(rawSpent),
        pct:
          totalSpent > 0 ? Math.round((rawSpent / totalSpent) * 100) : 0,
        color: getCatColor(categoryId, customCategories, idx),
      };
    })
    .sort((a, b) => b.spent - a.spent);

  return sorted.slice(0, limit);
}

export function getRecentTransactions(
  transactions,
  { manualExpenses = [], excludedTxIds = new Set() } = {},
  limit = 5,
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const manual = Array.isArray(manualExpenses) ? manualExpenses : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);

  const normalizedManual = manual.map((e) => ({
    id: `manual_${e.id}`,
    time: e.date ? Math.floor(new Date(e.date).getTime() / 1000) : 0,
    amount: -(Math.abs(e.amount) * 100),
    description: e.description || "",
    mcc: 0,
    _manual: true,
    _category: e.category,
  }));

  const all = [
    ...list.filter((tx) => tx && !excluded.has(tx.id)),
    ...normalizedManual,
  ].sort((a, b) => (b.time || 0) - (a.time || 0));

  return all.slice(0, limit);
}

export function getMonthlyTrendComparison(
  currentTx,
  prevTx,
  { excludedTxIds = new Set(), txSplits = {} } = {},
) {
  const curr = getMonthlySummary(currentTx, { excludedTxIds, txSplits });
  const prev = getMonthlySummary(prevTx, { excludedTxIds, txSplits });
  const diff = curr.spent - prev.spent;
  const diffPct =
    prev.spent > 0 ? Math.round((diff / prev.spent) * 100) : null;

  return {
    currentSpent: curr.spent,
    prevSpent: prev.spent,
    diff,
    diffPct,
    currentIncome: curr.income,
    prevIncome: prev.income,
  };
}

export function getMonthlySpendSeries(monthlyData) {
  if (!Array.isArray(monthlyData)) return [];
  return monthlyData.map(
    ({ month, transactions, excludedTxIds, txSplits }) => {
      const txList = Array.isArray(transactions) ? transactions : [];
      const excluded =
        excludedTxIds instanceof Set ? excludedTxIds : new Set();
      const { spent, income } = getMonthlySummary(txList, {
        excludedTxIds: excluded,
        txSplits: txSplits || {},
      });
      const [year, mon] = (month || "").split("-");
      const label =
        year && mon
          ? new Date(
              Number(year),
              Number(mon) - 1,
              1,
            ).toLocaleDateString("uk-UA", { month: "short" })
          : month;
      return { month, label, spent, income };
    },
  );
}

export function getCategoryDistribution(
  transactions,
  {
    txCategories = {},
    txSplits = {},
    customCategories = [],
    excludedTxIds = new Set(),
  } = {},
) {
  const top = getTopCategories(
    transactions,
    { txCategories, txSplits, customCategories, excludedTxIds },
    20,
  );
  const totalSpent = top.reduce((s, c) => s + c.spent, 0);
  return top.map((c, idx) => ({
    ...c,
    pct: totalSpent > 0 ? Math.round((c.spent / totalSpent) * 100) : 0,
    color: c.color || getCatColor(c.categoryId, customCategories, idx),
  }));
}

export function getTopMerchants(
  transactions,
  { excludedTxIds = new Set() } = {},
  limit = 10,
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set ? excludedTxIds : new Set(excludedTxIds);
  const merchants = {};

  for (const tx of list) {
    if (!tx || excluded.has(tx.id) || tx.amount >= 0) continue;
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
