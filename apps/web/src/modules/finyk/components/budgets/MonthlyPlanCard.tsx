import { memo } from "react";
import { cn } from "@shared/lib/cn";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Input } from "@shared/components/ui/Input";

// Merged monthly-plan block: income/expense/savings inputs + fact summary +
// progress + safe-to-spend hint. Pure presentational; parent owns
// `monthlyPlan` and the computed fact/usage values.
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
  return (
    <div
      className={cn(
        "bg-panel border rounded-2xl p-5 shadow-card",
        isOver ? "border-danger/40" : "border-line",
      )}
    >
      <SectionHeading as="div" size="sm" className="mb-3">
        Фінплан на місяць
      </SectionHeading>
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

      {(planIncome > 0 || planExpense > 0) && (
        <div className="mt-4 pt-4 border-t border-line space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xs text-subtle mb-0.5">Дохід (план)</div>
              <div className="text-sm font-semibold tabular-nums">
                {planIncome > 0
                  ? `${planIncome.toLocaleString("uk-UA")} ₴`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-2xs text-subtle mb-0.5">Витрати (факт)</div>
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
                  isOver ? "text-danger" : "text-emerald-600",
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
                    : "bg-emerald-500/10 text-emerald-700",
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
  );
}

export const MonthlyPlanCard = memo(MonthlyPlanCardComponent);
