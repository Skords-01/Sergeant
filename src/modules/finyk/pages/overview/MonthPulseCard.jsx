import { memo } from "react";
import { cn } from "@shared/lib/cn";
import { computePulseStyle } from "./pulseStyle.js";

/**
 * Картка «Місяць» — дохід/витрати/прогрес, блок факт+прогнозу, фінпульс.
 * Це найбільша картка на Overview, тому винесена окремо; pulse-стилі
 * рахуються чистою функцією computePulseStyle.
 */
const MonthPulseCardImpl = function MonthPulseCard({
  dateLabel,
  daysInMonth,
  daysPassed,
  spent,
  income,
  showBalance,
  showMonthForecast,
  projectedSpend,
  spendPct,
  expenseFromIncomeBarClass,
  forecastTrendPct,
  forecastBarClass,
  dayBudget,
  monthBalance,
  spendPlanRatio,
  hasExpensePlan,
  recurringOutThisMonth,
  recurringInThisMonth,
  unknownOutCount,
}) {
  const { accentLeft, bg, color, statusText } = computePulseStyle({
    hasExpensePlan,
    spendPlanRatio,
    dayBudget,
  });

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-panel p-5 shadow-card border-l-[4px]",
        accentLeft,
        bg,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs font-medium text-subtle">Місяць</div>
          <p className="text-xs text-subtle/80 mt-0.5 capitalize">
            {dateLabel}
          </p>
        </div>
        <span className="text-xs text-subtle/60 shrink-0 text-right tabular-nums">
          {Math.max(0, daysInMonth - daysPassed)} дн. залишилось
        </span>
      </div>

      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="text-xs text-subtle font-medium">Витрати</div>
          <div className="text-hero font-bold tabular-nums mt-1 leading-tight">
            {showBalance
              ? spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })
              : "••••"}
            {showBalance && (
              <span className="text-base font-medium text-muted ml-1">₴</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-subtle font-medium">Дохід</div>
          <div className="text-hero font-bold tabular-nums mt-1 leading-tight text-success">
            {showBalance ? (
              <>
                +
                {income.toLocaleString("uk-UA", {
                  maximumFractionDigits: 0,
                })}
                <span className="text-base font-medium text-success/70 ml-1">
                  ₴
                </span>
              </>
            ) : (
              "••••"
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-xs text-subtle/70">
          <span>Витрати від доходу</span>
          <span>{showBalance ? `${Math.round(spendPct)}%` : "—"}</span>
        </div>
        <div className="h-1.5 bg-bg rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              expenseFromIncomeBarClass,
            )}
            style={{ width: showBalance ? `${spendPct}%` : "0%" }}
          />
        </div>
        <div className="flex justify-between text-xs text-subtle/70">
          <span>
            {showBalance
              ? `Залишок: ${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "—"}
          </span>
          <span>
            {showBalance && !showMonthForecast && projectedSpend > 0
              ? `Прогноз витрат ${projectedSpend.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : showBalance && showMonthForecast
                ? null
                : "—"}
          </span>
        </div>
      </div>

      {showMonthForecast && (
        <div className="mt-4 pt-4 border-t border-line space-y-2">
          <div className="text-xs font-medium text-subtle">
            Факт і прогноз витрат
          </div>
          <p className="text-xs text-subtle/80 leading-snug">
            За {daysPassed}{" "}
            {daysPassed === 1 ? "день" : daysPassed < 5 ? "дні" : "дн."} · факт{" "}
            <span className="font-semibold text-text tabular-nums">
              {spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
            </span>
            {" · "}до кінця місяця ~{" "}
            <span className="font-semibold text-text tabular-nums">
              {Math.round(projectedSpend).toLocaleString("uk-UA", {
                maximumFractionDigits: 0,
              })}{" "}
              ₴
            </span>
          </p>
          <div className="h-2.5 bg-bg rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                forecastBarClass,
              )}
              style={{ width: `${forecastTrendPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-subtle/70">
            <span>{forecastTrendPct}% від прогнозу за темпом</span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-line">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-subtle">Фінпульс</span>
          <span className="text-xs text-subtle/60">
            цільова витрата на день
          </span>
        </div>
        <div
          className={cn(
            "text-[30px] sm:text-[34px] font-bold leading-tight tabular-nums mt-2",
            color,
            !showBalance && "tracking-widest",
          )}
        >
          {showBalance ? (
            <>
              {Math.abs(dayBudget).toLocaleString("uk-UA", {
                maximumFractionDigits: 0,
              })}
              <span className="text-base font-medium text-subtle ml-1">
                ₴/день
              </span>
            </>
          ) : (
            "••••"
          )}
        </div>
        <div className={cn("text-sm mt-0.5", color)}>{statusText}</div>
        {(recurringOutThisMonth > 0 || recurringInThisMonth > 0) &&
          showBalance && (
            <div className="text-xs text-subtle/70 mt-2 leading-relaxed">
              Враховано планових: −
              {recurringOutThisMonth.toLocaleString("uk-UA", {
                maximumFractionDigits: 0,
              })}{" "}
              / +
              {recurringInThisMonth.toLocaleString("uk-UA", {
                maximumFractionDigits: 0,
              })}{" "}
              ₴{unknownOutCount > 0 && ` + ${unknownOutCount} без суми`}
            </div>
          )}
      </div>
    </div>
  );
};

export const MonthPulseCard = memo(MonthPulseCardImpl);
