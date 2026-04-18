import { useMemo } from "react";
import {
  calculateRemainingBudget,
  calculateSafeToSpendPerDay,
  getMonthBudgetSummary,
  getLimitBudgets,
  getGoalBudgets,
} from "../domain/budget";

export { calculateRemainingBudget, calculateSafeToSpendPerDay };

export function useBudget(storage) {
  const {
    budgets,
    setBudgets,
    monthlyPlan,
    setMonthlyPlan,
    excludedTxIds,
    txSplits,
  } = storage;

  const limitBudgets = useMemo(() => getLimitBudgets(budgets), [budgets]);
  const goalBudgets = useMemo(() => getGoalBudgets(budgets), [budgets]);

  const getMonthBudgetSummaryLocal = (transactions) =>
    getMonthBudgetSummary(transactions, {
      excludedTxIds,
      txSplits,
      monthlyPlan,
    });

  const addBudget = (budget) => {
    setBudgets((b) => [...b, { ...budget, id: crypto.randomUUID() }]);
  };

  const removeBudget = (id) => {
    setBudgets((bs) => bs.filter((b) => b.id !== id));
  };

  const updateBudget = (id, patch) => {
    setBudgets((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  return {
    budgets,
    limitBudgets,
    goalBudgets,
    monthlyPlan,
    setMonthlyPlan,
    calculateRemainingBudget,
    calculateSafeToSpendPerDay,
    getMonthBudgetSummary: getMonthBudgetSummaryLocal,
    addBudget,
    removeBudget,
    updateBudget,
  };
}
