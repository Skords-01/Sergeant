import { memo } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Верхня градієнтна картка з нетворсом, balance-of-the-month і breakdown-ом
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
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-5 shadow-float border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-emerald-100/90 text-sm">Загальний нетворс</p>
          <p className="text-xs text-emerald-200/70 mt-0.5">
            {firstName} · {dateLabel}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "text-[40px] font-bold tracking-tight leading-tight mt-2 tabular-nums",
          !showBalance && "tracking-widest",
        )}
      >
        {showBalance ? (
          <>
            {networth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
            <span className="text-2xl font-semibold text-emerald-100 ml-1">
              ₴
            </span>
          </>
        ) : (
          "••••••"
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 text-emerald-100">
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
        <span className="text-sm">
          {showBalance
            ? `Баланс місяця: ${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
            : "••••"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-white/20 text-sm">
        <div>
          <div className="text-xs text-emerald-200/80 mb-0.5">На картках</div>
          <div className="font-semibold tabular-nums text-emerald-50">
            {showBalance
              ? `+${monoTotal.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "••••"}
          </div>
        </div>
        <div className="w-px bg-white/25 hidden sm:block self-stretch min-h-[2.5rem]" />
        <div>
          <div className="text-xs text-emerald-200/80 mb-0.5">Борги</div>
          <div className="font-semibold tabular-nums text-emerald-50">
            {showBalance
              ? `−${totalDebt.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "••••"}
          </div>
        </div>
      </div>
    </div>
  );
};

export const HeroCard = memo(HeroCardImpl);
