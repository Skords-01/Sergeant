import { useMemo } from "react";
import {
  getCategoryDistribution,
  getTopMerchants,
  getMonthlySpendSeries,
  getMonthlyTrendComparison,
} from "../lib/finykStats";
import { getMonthlySummary, getTopCategories } from "../domain/selectors";

export function useAnalytics({ mono, storage, monthlyHistory = [] }) {
  const { realTx = [], loadingTx } = mono;
  const { excludedTxIds, txCategories, txSplits, customCategories } = storage;

  const opts = useMemo(
    () => ({ excludedTxIds, txCategories, txSplits, customCategories }),
    [excludedTxIds, txCategories, txSplits, customCategories],
  );

  const summary = useMemo(
    () => getMonthlySummary(realTx, { excludedTxIds, txSplits }),

    [realTx, excludedTxIds, txSplits],
  );

  const topCategories = useMemo(
    () => getTopCategories(realTx, opts, 5),

    [realTx, opts],
  );

  const distribution = useMemo(
    () => getCategoryDistribution(realTx, opts),

    [realTx, opts],
  );

  const topMerchants = useMemo(
    () => getTopMerchants(realTx, { excludedTxIds }),

    [realTx, excludedTxIds],
  );

  const monthlyTrend = useMemo(
    () => getMonthlySpendSeries(monthlyHistory),
    [monthlyHistory],
  );

  const comparison = useMemo(() => {
    if (monthlyHistory.length < 2) return null;
    const curr = monthlyHistory[monthlyHistory.length - 1];
    const prev = monthlyHistory[monthlyHistory.length - 2];
    return getMonthlyTrendComparison(
      curr?.transactions || [],
      prev?.transactions || [],
      { excludedTxIds, txSplits },
    );
  }, [monthlyHistory, excludedTxIds, txSplits]);

  return {
    summary,
    topCategories,
    distribution,
    topMerchants,
    monthlyTrend,
    comparison,
    isLoading: loadingTx,
  };
}
