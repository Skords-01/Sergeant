import { memo } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Верхня картка з нетворсом, balance-of-the-month і breakdown-ом
 * (картки / борги / місяць). Чисто презентаційна — усі значення обчислює
 * Overview.
 */
const HeroCardImpl = function HeroCard({
  networth,
  monoTotal,
  totalDebt,
  monthBalance,
  firstName,
  dateLabel,
  showBalance = true,
  dayBudget = 0,
  spendPlanRatio = 0,
}) {
  return (
    <div className="rounded-3xl bg-finyk/[.06] dark:bg-finyk-surface-dark/10 border border-finyk/[.14] dark:border-finyk-border-dark/20 p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted">Загальний нетворс</p>
          <p className="text-xs text-subtle mt-0.5">
            {firstName} · {dateLabel}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "text-[40px] font-bold tracking-tight leading-tight mt-2 tabular-nums text-finyk-strong dark:text-finyk",
          !showBalance && "tracking-widest",
        )}
      >
        {showBalance ? (
          <>
            {networth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
            <span className="text-2xl font-semibold text-finyk/60 ml-1">₴</span>
          </>
        ) : (
          "••••••"
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 text-finyk">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-90"
          aria-hidden
        >
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
        <span className="text-sm text-muted">
          {showBalance
            ? `Баланс місяця: ${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
            : "••••"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-finyk/20 text-sm">
        <div>
          <div className="text-xs text-subtle mb-0.5">На картках</div>
          <div className="font-semibold tabular-nums text-text">
            {showBalance
              ? `+${monoTotal.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "••••"}
          </div>
        </div>
        <div className="w-px bg-finyk/20 hidden sm:block self-stretch min-h-[2.5rem]" />
        <div>
          <div className="text-xs text-subtle mb-0.5">Борги</div>
          <div className="font-semibold tabular-nums text-text">
            {showBalance
              ? `−${totalDebt.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "••••"}
          </div>
        </div>
      </div>
      {dayBudget > 0 && (
        <div className="mt-3 px-3 py-2.5 rounded-2xl bg-finyk/[.06] border border-finyk/[.14]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">
              Бюджет на день
            </span>
            <span className="text-base font-extrabold text-finyk-strong dark:text-finyk">
              {Math.round(dayBudget).toLocaleString("uk-UA", {
                maximumFractionDigits: 0,
              })}{" "}
              ₴
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-finyk/[.15] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500"
              style={{ width: `${Math.min(100, spendPlanRatio * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const HeroCard = memo(HeroCardImpl);
