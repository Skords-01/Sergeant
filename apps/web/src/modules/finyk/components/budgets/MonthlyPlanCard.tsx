import { memo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { Input } from "@shared/components/ui/Input";

// Merged monthly-plan block: income/expense/savings inputs + fact summary +
// progress + safe-to-spend hint. Collapsible — defaults closed so the
// Планування page opens with stats-strip + limit cards in view, mirroring
// the "Прогноз" / "AI-порада" sections inside `LimitBudgetCard`. When
// collapsed the header still surfaces plan/fact/pct at a glance; the
// inputs + trend only appear when the user opens it. Pure presentational,
// parent owns `monthlyPlan` + computed fact/usage values.
function MonthlyPlanCardComponent({
  monthlyPlan,
  onChangeMonthlyPlan,
  planIncome,
  planExpense,
  totalExpenseFact,
  remaining,
  safePerDay,
  pctExpense,
  isOver,
  daysLeft,
}) {
  const [open, setOpen] = useState(false);
  const hasPlan = planIncome > 0 || planExpense > 0;

  return (
    <div
      className={cn(
        "bg-panel border rounded-2xl shadow-card overflow-hidden",
        isOver ? "border-danger/40" : "border-line",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-panelHi transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted" aria-hidden>
            <Icon name="calendar" size={16} />
          </span>
          <span className="text-sm font-semibold text-text">
            Фінплан на місяць
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasPlan && !open && (
            <span
              className={cn(
                "text-xs tabular-nums",
                isOver ? "text-danger font-semibold" : "text-muted",
              )}
            >
              {isOver
                ? `−${(totalExpenseFact - planExpense).toLocaleString("uk-UA")} ₴`
                : planExpense > 0
                  ? `${pctExpense}% · ${remaining.toLocaleString("uk-UA")} ₴`
                  : `+${planIncome.toLocaleString("uk-UA")} ₴`}
            </span>
          )}
          {!hasPlan && !open && (
            <span className="text-xs text-subtle">Не заданий</span>
          )}
          <Icon
            name="chevron-down"
            size={14}
            className={cn(
              "transition-transform text-muted",
              open ? "rotate-180" : "",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="План доходу ₴"
              value={monthlyPlan?.income ?? ""}
              onChange={(e) =>
                onChangeMonthlyPlan((p) => ({
                  ...(p || {}),
                  income: e.target.value,
                }))
              }
            />
            <Input
              type="number"
              placeholder="План витрат ₴"
              value={monthlyPlan?.expense ?? ""}
              onChange={(e) =>
                onChangeMonthlyPlan((p) => ({
                  ...(p || {}),
                  expense: e.target.value,
                }))
              }
            />
            <Input
              type="number"
              placeholder="План накопичень ₴"
              value={monthlyPlan?.savings ?? ""}
              onChange={(e) =>
                onChangeMonthlyPlan((p) => ({
                  ...(p || {}),
                  savings: e.target.value,
                }))
              }
            />
          </div>

          {hasPlan && (
            <div className="mt-4 pt-4 border-t border-line space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xs text-subtle mb-0.5">
                    Дохід (план)
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {planIncome > 0
                      ? `${planIncome.toLocaleString("uk-UA")} ₴`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-2xs text-subtle mb-0.5">
                    Витрати (факт)
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isOver ? "text-danger" : "",
                    )}
                  >
                    {totalExpenseFact.toLocaleString("uk-UA")} ₴
                  </div>
                </div>
                <div>
                  <div className="text-2xs text-subtle mb-0.5">Залишок</div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isOver
                        ? "text-danger"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {isOver
                      ? `−${(totalExpenseFact - planExpense).toLocaleString("uk-UA")} ₴`
                      : `${remaining.toLocaleString("uk-UA")} ₴`}
                  </div>
                </div>
              </div>

              {planExpense > 0 && (
                <>
                  <div className="flex justify-between text-xs text-subtle">
                    <span>{pctExpense}% від плану</span>
                    <span>план {planExpense.toLocaleString("uk-UA")} ₴</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isOver
                          ? "bg-danger"
                          : pctExpense >= 85
                            ? "bg-warning"
                            : "bg-emerald-500",
                      )}
                      style={{ width: `${pctExpense}%` }}
                    />
                  </div>
                </>
              )}

              {safePerDay > 0 && daysLeft > 0 && planExpense > 0 && (
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    isOver
                      ? "bg-danger/10 text-danger"
                      : pctExpense >= 85
                        ? "bg-warning/10 text-warning"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  <span className="font-semibold">
                    {safePerDay.toLocaleString("uk-UA")} ₴/день
                  </span>
                  <span className="text-xs ml-1 opacity-75">
                    · безпечно витрачати ({daysLeft} дн.)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MonthlyPlanCard = memo(MonthlyPlanCardComponent);
