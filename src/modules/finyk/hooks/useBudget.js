import { useMemo } from "react";
import {
  calculateRemainingBudget,
  calculateSafeToSpendPerDay,
  getMonthBudgetSummary,
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

  const limitBudgets = useMemo(
    () => budgets.filter((b) => b.type === "limit"),
    [budgets],
  );
  const goalBudgets = useMemo(
    () => budgets.filter((b) => b.type === "goal"),
    [budgets],
  );

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
