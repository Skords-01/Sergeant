import { useState, useEffect, useMemo, useRef } from "react";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { cn } from "@shared/lib/cn";
import { useAnalytics } from "../hooks/useAnalytics";
import { CategoryPieChart } from "../components/analytics/CategoryPieChart";
import { MerchantList } from "../components/analytics/MerchantList";
import { getMonthlyTrendComparison } from "../lib/finykStats";

function readTxCache(year, month) {
  try {
    const raw = localStorage.getItem(`finyk_tx_cache_${year}_${month}`);
    if (!raw) return null;
    const { txs } = JSON.parse(raw);
    return Array.isArray(txs) ? txs : null;
  } catch {
    return null;
  }
}

function Section({ title, children, className }) {
  return (
    <div
      className={cn(
        "bg-panel border border-line/60 rounded-2xl p-5 shadow-card",
        className,
      )}
    >
      <div className="text-[11px] font-bold text-subtle uppercase tracking-widest mb-4">
        {title}
      </div>
      {children}
    </div>
  );
}

function MonthNav({ year, month, onChange }) {
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const label = new Date(year, month - 1, 1).toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });

  const go = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    onChange(y, m);
  };

  return (
    <div className="flex items-center justify-between">
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
        {prev > 0 && pct !== null && (
          <span
            className={cn(
              "text-xs",
              diff === 0
                ? "text-muted"
                : up
                  ? "text-danger"
                  : "text-emerald-600",
            )}
          >
            {up ? "+" : ""}
            {pct}%
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
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(new Set());

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const isPrevCurrent =
    prevYear === now.getFullYear() && prevMonth === now.getMonth() + 1;

  const ensureMonth = (y, m, key) => {
    if (fetchingRef.current.has(key)) return;
    const cached = readTxCache(y, m);
    if (cached) {
      setHistoryCache((prev) =>
        prev[key] ? prev : { ...prev, [key]: cached },
      );
      return;
    }
    fetchingRef.current.add(key);
    setLoading(true);
    mono
      .fetchMonth(y, m)
      .then(() => {
        const txs = readTxCache(y, m) || [];
        setHistoryCache((prev) => ({ ...prev, [key]: txs }));
      })
      .catch(() => {
        setHistoryCache((prev) => ({ ...prev, [key]: [] }));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isCurrentMonth && !historyCache[monthKey]) {
      ensureMonth(year, month, monthKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, isCurrentMonth, monthKey]);

  useEffect(() => {
    if (!isPrevCurrent && !historyCache[prevKey]) {
      ensureMonth(prevYear, prevMonth, prevKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevYear, prevMonth, isPrevCurrent, prevKey]);

  const activeTx = useMemo(() => {
    if (isCurrentMonth) return mono.realTx || [];
    return historyCache[monthKey] || [];
  }, [isCurrentMonth, mono.realTx, historyCache, monthKey]);

  const prevTx = useMemo(() => {
    if (isPrevCurrent) return mono.realTx || [];
    return historyCache[prevKey] || [];
  }, [isPrevCurrent, mono.realTx, historyCache, prevKey]);

  const { summary, distribution, topMerchants, isLoading } = useAnalytics({
    mono: { ...mono, realTx: activeTx, loadingTx: mono.loadingTx || loading },
    storage,
  });

  const comparison = useMemo(() => {
    if (!prevTx.length && !historyCache[prevKey]) return null;
    return getMonthlyTrendComparison(activeTx, prevTx, {
      excludedTxIds: storage.excludedTxIds,
      txSplits: storage.txSplits,
    });
  }, [activeTx, prevTx, historyCache, prevKey, storage.excludedTxIds, storage.txSplits]);

  const pageLoading = (isCurrentMonth ? mono.loadingTx : loading) && activeTx.length === 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <MonthNav
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />

        {/* Summary */}
        <Section title="Підсумок місяця">
          {pageLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[10px] text-subtle mb-1">Витрати</div>
                <div className="text-sm font-bold tabular-nums text-danger">
                  {summary.spent.toLocaleString("uk-UA")} ₴
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-subtle mb-1">Дохід</div>
                <div className="text-sm font-bold tabular-nums text-emerald-600">
                  {summary.income.toLocaleString("uk-UA")} ₴
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-subtle mb-1">Баланс</div>
                <div
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    summary.balance >= 0 ? "text-emerald-600" : "text-danger",
                  )}
                >
                  {summary.balance >= 0 ? "+" : ""}
                  {summary.balance.toLocaleString("uk-UA")} ₴
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Comparison */}
        {comparison && (
          <Section title="Порівняння з попереднім місяцем">
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
          </Section>
        )}

        {/* Categories */}
        <Section title="Категорії">
          {pageLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : distribution.length === 0 ? (
            <EmptyState
              compact
              title="Немає витрат"
              description="Транзакцій за цей місяць не знайдено"
            />
          ) : (
            <CategoryPieChart data={distribution} />
          )}
        </Section>

        {/* Merchants */}
        <Section title="Топ мерчанти">
          {pageLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 rounded-xl" />
              ))}
            </div>
          ) : topMerchants.length === 0 ? (
            <EmptyState
              compact
              title="Немає даних"
              description="Транзакцій ще немає"
            />
          ) : (
            <MerchantList merchants={topMerchants} />
          )}
        </Section>
      </div>
    </div>
  );
}
