import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { cn } from "@shared/lib/cn";
import { useAnalytics } from "../hooks/useAnalytics";
import { MonthlyChart } from "../components/analytics/MonthlyChart";
import { CategoryPieChart } from "../components/analytics/CategoryPieChart";
import { MerchantList } from "../components/analytics/MerchantList";
import { getMonthlyTrendComparison } from "../lib/finykStats";

function Section({ title, children, className }) {
  return (
    <div className={cn("bg-panel border border-line/60 rounded-2xl p-5 shadow-card", className)}>
      <div className="text-[11px] font-bold text-subtle uppercase tracking-widest mb-4">
        {title}
      </div>
      {children}
    </div>
  );
}

function MonthNav({ year, month, onChange }) {
  const label = new Date(year, month - 1, 1).toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const go = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    onChange(y, m);
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        type="button"
        onClick={() => go(-1)}
        className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:text-text hover:bg-panelHi transition-colors"
        aria-label="Попередній місяць"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-text capitalize">{label}</span>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={isCurrentMonth}
        className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:text-text hover:bg-panelHi transition-colors disabled:opacity-30"
        aria-label="Наступний місяць"
      >
        ›
      </button>
    </div>
  );
}

function ComparisonRow({ label, current, prev }) {
  const diff = current - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
  const up = diff > 0;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="text-text font-medium">
          {current.toLocaleString("uk-UA")} ₴
        </span>
        {prev > 0 && (
          <span
            className={cn(
              "text-xs",
              diff === 0 ? "text-muted" : up ? "text-danger" : "text-emerald-600",
            )}
          >
            {diff === 0 ? "=" : up ? "+" : ""}
            {pct !== null ? `${pct}%` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function Analytics({ mono, storage }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const [historyCache, setHistoryCache] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isCurrentMonth) return;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (historyCache[key]) return;

    setLoadingHistory(true);
    mono
      .fetchMonth(year, month)
      .then((txs) => {
        setHistoryCache((prev) => ({ ...prev, [key]: txs || [] }));
      })
      .finally(() => setLoadingHistory(false));
  }, [year, month, isCurrentMonth, mono, historyCache]);

  const activeTx = useMemo(() => {
    if (isCurrentMonth) return mono.realTx || [];
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return historyCache[key] || [];
  }, [isCurrentMonth, mono.realTx, historyCache, year, month]);

  const prevMonthKey = useMemo(() => {
    let pm = month - 1;
    let py = year;
    if (pm < 1) { pm = 12; py--; }
    return `${py}-${String(pm).padStart(2, "0")}`;
  }, [year, month]);

  const prevTx = useMemo(() => {
    let pm = month - 1;
    let py = year;
    if (pm < 1) { pm = 12; py--; }
    const isPrevCurrent =
      py === now.getFullYear() && pm === now.getMonth() + 1;
    if (isPrevCurrent) return mono.realTx || [];
    return historyCache[prevMonthKey] || [];
  }, [month, year, historyCache, prevMonthKey, mono.realTx, now]);

  const [loadingPrev, setLoadingPrev] = useState(false);
  useEffect(() => {
    let pm = month - 1, py = year;
    if (pm < 1) { pm = 12; py--; }
    const isPrevCurrent = py === now.getFullYear() && pm === now.getMonth() + 1;
    if (isPrevCurrent || historyCache[prevMonthKey]) return;

    setLoadingPrev(true);
    mono
      .fetchMonth(py, pm)
      .then((txs) => {
        setHistoryCache((prev) => ({ ...prev, [prevMonthKey]: txs || [] }));
      })
      .finally(() => setLoadingPrev(false));
  }, [prevMonthKey, historyCache, mono, month, year, now]);

  const {
    summary,
    topCategories,
    distribution,
    topMerchants,
    isLoading,
  } = useAnalytics({
    mono: { ...mono, realTx: activeTx, loadingTx: mono.loadingTx || loadingHistory },
    storage,
  });

  const comparison = useMemo(() => {
    if (prevTx.length === 0 && !loadingPrev) return null;
    return getMonthlyTrendComparison(activeTx, prevTx, {
      excludedTxIds: storage.excludedTxIds,
      txSplits: storage.txSplits,
    });
  }, [activeTx, prevTx, storage.excludedTxIds, storage.txSplits, loadingPrev]);

  const loading = isLoading || loadingHistory;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <MonthNav
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m); }}
        />

        {/* Summary */}
        <Section title="Підсумок місяця">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Витрати", value: summary.spent, danger: true },
                { label: "Дохід", value: summary.income, success: true },
                { label: "Баланс", value: summary.balance, signed: true },
              ].map(({ label, value, danger, success, signed }) => (
                <div key={label} className="text-center">
                  <div className="text-[10px] text-subtle mb-1">{label}</div>
                  <div
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      danger && value > 0 ? "text-danger" : "",
                      success && value > 0 ? "text-emerald-600" : "",
                      signed && value < 0 ? "text-danger" : "",
                      signed && value > 0 ? "text-emerald-600" : "",
                      "text-text",
                    )}
                  >
                    {signed && value > 0 ? "+" : ""}
                    {value.toLocaleString("uk-UA")} ₴
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Comparison with prev month */}
        {(comparison || loadingPrev) && (
          <Section title="Порівняння з попереднім місяцем">
            {loadingPrev ? (
              <div className="space-y-2">
                <Skeleton className="h-6 rounded-lg" />
                <Skeleton className="h-6 rounded-lg opacity-70" />
              </div>
            ) : (
              <div className="space-y-2">
                <ComparisonRow
                  label="Витрати"
                  current={comparison.currentSpent}
                  prev={comparison.prevSpent}
                />
                <ComparisonRow
                  label="Дохід"
                  current={comparison.currentIncome}
                  prev={comparison.prevIncome}
                />
              </div>
            )}
          </Section>
        )}

        {/* Category pie chart */}
        <Section title="Категорії">
          {loading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : distribution.length === 0 ? (
            <EmptyState compact title="Немає витрат" description="Транзакцій за цей місяць не знайдено" />
          ) : (
            <CategoryPieChart data={distribution} />
          )}
        </Section>

        {/* Top merchants */}
        <Section title="Топ мерчанти">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-xl" />)}
            </div>
          ) : topMerchants.length === 0 ? (
            <EmptyState compact title="Немає даних" description="Транзакцій ще немає" />
          ) : (
            <MerchantList merchants={topMerchants} />
          )}
        </Section>
      </div>
    </div>
  );
}
