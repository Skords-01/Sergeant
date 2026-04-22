import { memo, Suspense, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { BudgetTrendChart } from "../charts/lazy";
import { ChartFallback } from "../charts/ChartFallback";

// Single forecast card: category label + forecast vs limit + lazy trend
// chart + AI explanation slot and an "explain" action. Pure presentational;
// parent supplies `explanation`, `loading`, and `onExplain`.
function BudgetForecastCardComponent({
  forecast: fc,
  categoryLabel,
  explanation,
  loading,
  onExplain,
}) {
  const [explanationOpen, setExplanationOpen] = useState(true);

  return (
    <div
      className={cn(
        "bg-panel border rounded-2xl p-5 shadow-card",
        fc.overLimit ? "border-danger/50" : "border-line",
      )}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-sm font-semibold">{categoryLabel}</span>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={cn(
              "text-xs tabular-nums font-semibold",
              fc.overLimit ? "text-danger" : "text-muted",
            )}
          >
            {fc.forecast.toLocaleString("uk-UA")} ₴
          </span>
          <span className="text-2xs text-subtle tabular-nums">
            ліміт {fc.limit.toLocaleString("uk-UA")} ₴
          </span>
        </div>
      </div>

      {fc.overLimit ? (
        <div className="text-xs text-danger font-medium mb-2">
          ⚠️ Перевищення на {fc.overPercent}% (+
          {(fc.forecast - fc.limit).toLocaleString("uk-UA")} ₴)
        </div>
      ) : (
        <div className="text-xs text-subtle mb-2">
          Вкладається у ліміт · залишок{" "}
          {(fc.limit - fc.forecast).toLocaleString("uk-UA")} ₴
        </div>
      )}

      <Suspense fallback={<ChartFallback className="h-20 mb-2" />}>
        <BudgetTrendChart
          dailyData={fc.dailyData}
          limit={fc.limit}
          color={fc.overLimit ? "#ef4444" : "#6366f1"}
          className="mb-2"
        />
      </Suspense>

      <div className="flex items-center justify-between text-2xs text-subtle mt-1 mb-2">
        <span>Факт: {fc.spent.toLocaleString("uk-UA")} ₴</span>
        <span>≈{fc.avgPerDay.toLocaleString("uk-UA")} ₴/день</span>
        <span>Залишилось: {fc.daysRemaining} дн.</span>
      </div>

      {explanation && (
        <div className="bg-bg rounded-xl overflow-hidden mb-2">
          <button
            type="button"
            onClick={() => setExplanationOpen((v) => !v)}
            aria-expanded={explanationOpen}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-panelHi transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-text">
              <span className="text-base leading-none">✨</span>
              AI-пояснення
            </span>
            <Icon
              name="chevron-down"
              size={14}
              className={cn(
                "transition-transform text-muted",
                explanationOpen ? "rotate-180" : "",
              )}
            />
          </button>
          {explanationOpen && (
            <p className="px-3 pb-2 text-xs text-text leading-relaxed">
              {explanation}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={onExplain}
        className={cn(
          "text-xs px-3 py-1.5 rounded-lg border transition-colors w-full",
          loading
            ? "border-line text-subtle cursor-wait"
            : "border-primary/40 text-primary hover:bg-primary/10",
        )}
      >
        {loading
          ? "AI аналізує…"
          : explanation
            ? "🔄 Пояснити знову"
            : "✨ Пояснити"}
      </button>
    </div>
  );
}

export const BudgetForecastCard = memo(BudgetForecastCardComponent);
