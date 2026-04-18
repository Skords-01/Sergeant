import { cn } from "@shared/lib/cn";

export function BudgetOverviewCard({
  totalPlan,
  totalFact,
  totalRemaining,
  safePerDay,
  isOverall,
  daysLeft,
  planIncome,
}) {
  const pct =
    totalPlan > 0 ? Math.min(100, Math.round((totalFact / totalPlan) * 100)) : 0;

  const barColor =
    isOverall ? "bg-danger" : pct >= 85 ? "bg-warning" : "bg-emerald-500";

  return (
    <div
      className={cn(
        "bg-panel border rounded-2xl p-5 shadow-card",
        isOverall ? "border-danger/40" : "border-line/60",
      )}
    >
      <div className="text-[11px] font-bold text-subtle uppercase tracking-widest mb-3">
        Фінплан · місяць
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-[10px] text-subtle mb-0.5">Дохід (план)</div>
          <div className="text-sm font-semibold tabular-nums text-text">
            {planIncome > 0 ? `${planIncome.toLocaleString("uk-UA")} ₴` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-subtle mb-0.5">Витрати (факт)</div>
          <div
            className={cn(
              "text-sm font-semibold tabular-nums",
              isOverall ? "text-danger" : "text-text",
            )}
          >
            {totalFact.toLocaleString("uk-UA")} ₴
          </div>
        </div>
        <div>
          <div className="text-[10px] text-subtle mb-0.5">Залишок</div>
          <div
            className={cn(
              "text-sm font-semibold tabular-nums",
              isOverall ? "text-danger" : "text-emerald-600",
            )}
          >
            {isOverall
              ? `−${Math.abs(totalRemaining).toLocaleString("uk-UA")} ₴`
              : `${totalRemaining.toLocaleString("uk-UA")} ₴`}
          </div>
        </div>
      </div>

      {totalPlan > 0 && (
        <>
          <div className="flex justify-between text-[11px] text-subtle mb-1">
            <span>{pct}% плану</span>
            <span>план {totalPlan.toLocaleString("uk-UA")} ₴</span>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden mb-3">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}

      {safePerDay > 0 && daysLeft > 0 && (
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-sm",
            isOverall
              ? "bg-danger/10 text-danger"
              : pct >= 85
                ? "bg-warning/10 text-warning"
                : "bg-emerald-500/10 text-emerald-700",
          )}
        >
          <span className="font-semibold">
            {safePerDay.toLocaleString("uk-UA")} ₴/день
          </span>
          <span className="text-[11px] ml-1 opacity-75">
            · безпечно витрачати ({daysLeft} дн. до кінця)
          </span>
        </div>
      )}
    </div>
  );
}
