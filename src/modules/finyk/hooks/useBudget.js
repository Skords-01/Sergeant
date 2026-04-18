import { useMemo } from "react";
import { getTxStatAmount } from "../utils";

export function calculateRemainingBudget(budget, spent) {
  const limit = budget.limit || 0;
  const remaining = Math.max(0, limit - spent);
  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  return { remaining, pct, isOver: spent > limit };
}

export function calculateSafeToSpendPerDay(remaining, daysLeft) {
  if (daysLeft <= 0) return 0;
  return Math.max(0, Math.floor(remaining / daysLeft));
}

export function useBudget(storage) {
  const { budgets, setBudgets, monthlyPlan, setMonthlyPlan, excludedTxIds, txSplits } =
    storage;

  const limitBudgets = useMemo(
    () => budgets.filter((b) => b.type === "limit"),
    [budgets],
  );
  const goalBudgets = useMemo(
    () => budgets.filter((b) => b.type === "goal"),
    [budgets],
  );

  const getMonthBudgetSummary = (transactions) => {
    const excluded =
      excludedTxIds instanceof Set ? excludedTxIds : new Set();
    const splits = txSplits || {};
    const planExpense = Number(monthlyPlan?.income || 0);
    const planIncome = Number(monthlyPlan?.income || 0);

    const statTx = Array.isArray(transactions)
      ? transactions.filter((t) => t && !excluded.has(t.id))
      : [];

    const totalFact = Math.round(
      statTx
        .filter((t) => t.amount < 0)
        .reduce((s, t) => s + getTxStatAmount(t, splits), 0),
    );

    const planExpenseNum = Number(monthlyPlan?.expense || 0);
    const remaining = Math.max(0, planExpenseNum - totalFact);
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const daysLeft = daysInMonth - now.getDate();
    const safePerDay = calculateSafeToSpendPerDay(remaining, daysLeft);

    return {
      totalPlan: planExpenseNum,
      planIncome,
      totalFact,
      totalRemaining: remaining,
      safePerDay,
      isOverall: planExpenseNum > 0 && totalFact > planExpenseNum,
      daysLeft,
    };
  };

  const addBudget = (budget) => {
    setBudgets((b) => [...b, { ...budget, id: crypto.randomUUID() }]);
  };

  const removeBudget = (id) => {
    setBudgets((bs) => bs.filter((b) => b.id !== id));
  };

  const updateBudget = (id, patch) => {
    setBudgets((bs) =>
      bs.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  };

  return {
    budgets,
    limitBudgets,
    goalBudgets,
    monthlyPlan,
    setMonthlyPlan,
    calculateRemainingBudget,
    calculateSafeToSpendPerDay,
    getMonthBudgetSummary,
    addBudget,
    removeBudget,
    updateBudget,
  };
}
