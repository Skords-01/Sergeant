import { memo, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import {
  formatComparisonSummary,
  getCurrentVsPreviousComparison,
} from "../domain/selectors";

const MONTH_LABELS_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

// "2025-02" → "лютого 2025". Робочий підпис у заголовку картки для
// попереднього місяця — без часу доби, без локалей.
function formatMonthKeyLabel(key) {
  if (!key) return "";
  const [ys, ms] = key.split("-");
  const year = Number(ys);
  const monthIdx = Number(ms) - 1;
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) return key;
  return `${MONTH_LABELS_GENITIVE[monthIdx]} ${year}`;
}

/**
 * Проста ретроспективна картка «цей місяць vs попередній».
 * Показує поточну суму витрат, різницю та %, плюс коротке речення.
 *
 * Це суто презентаційний компонент: всю математику робить селектор
 * `getCurrentVsPreviousComparison`, а текст — `formatComparisonSummary`.
 * Якщо порівнювати немає з чим (в обох місяцях нуль), повертає `null`,
 * щоб не захаращувати Overview порожніми блоками.
 */
export const RetroComparison = memo(function RetroComparison({
  transactions,
  excludedTxIds,
  txSplits,
  now,
  showBalance = true,
  className,
}) {
  const comparison = useMemo(
    () =>
      getCurrentVsPreviousComparison(transactions, {
        now,
        excludedTxIds,
        txSplits,
      }),
    [transactions, now, excludedTxIds, txSplits],
  );

  const summary = useMemo(
    () =>
      formatComparisonSummary(comparison, {
        prevLabel: formatMonthKeyLabel(comparison.previousMonth),
      }),
    [comparison],
  );

  // Пусто по обидва боки — немає сенсу рендерити секцію.
  if (
    comparison.currentSpent === 0 &&
    comparison.prevSpent === 0 &&
    comparison.currentIncome === 0 &&
    comparison.prevIncome === 0
  ) {
    return null;
  }

  const { direction } = summary;
  const diffColor =
    direction === "up"
      ? "text-danger"
      : direction === "down"
        ? "text-success"
        : "text-muted";
  const accentBorder =
    direction === "up"
      ? "border-l-red-500"
      : direction === "down"
        ? "border-l-emerald-500"
        : "border-l-line";

  const diffSign = comparison.diff > 0 ? "+" : comparison.diff < 0 ? "−" : "";
  const diffAbs = Math.abs(comparison.diff).toLocaleString("uk-UA", {
    maximumFractionDigits: 0,
  });
  const pct =
    comparison.diffPct != null
      ? `${comparison.diff > 0 ? "+" : ""}${comparison.diffPct}%`
      : "—";

  return (
    <div
      className={cn(
        "rounded-2xl border border-line/60 bg-panel p-5 shadow-card border-l-[4px]",
        accentBorder,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold text-subtle uppercase tracking-widest">
            Порівняння з попереднім місяцем
          </div>
          <p className="text-[11px] text-subtle/80 mt-1 capitalize">
            vs {formatMonthKeyLabel(comparison.previousMonth)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <div className="text-[11px] text-subtle mb-1">Цього місяця</div>
          <div className="text-lg font-semibold tabular-nums text-text">
            {showBalance
              ? `${comparison.currentSpent.toLocaleString("uk-UA")} ₴`
              : "••••"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-subtle mb-1">Різниця</div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums flex items-baseline gap-2",
              diffColor,
            )}
          >
            <span>
              {showBalance ? (
                <>
                  {diffSign}
                  {diffAbs} ₴
                </>
              ) : (
                "••••"
              )}
            </span>
            {showBalance && comparison.diffPct != null && (
              <span className="text-xs">{pct}</span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted mt-4 leading-relaxed">{summary.text}</p>
    </div>
  );
});
