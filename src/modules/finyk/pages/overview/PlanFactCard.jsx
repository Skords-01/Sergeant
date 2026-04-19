import { cn } from "@shared/lib/cn";
import { Card } from "@shared/components/ui/Card";

/**
 * Картка «План / Факт» — показує planIncome/planExpense/planSavings поряд з
 * фактичними income/spent/factSavings. Показується лише якщо юзер задав
 * хоч одну цифру плану.
 */
export function PlanFactCard({
  planIncome,
  planExpense,
  planSavings,
  income,
  spent,
  factSavings,
}) {
  if (!(planIncome > 0 || planExpense > 0 || planSavings > 0)) return null;

  return (
    <Card radius="lg" padding="lg">
      <div className="text-xs font-medium text-subtle mb-3">План / Факт</div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="text-xs text-subtle/60 mb-1">План</div>
          <div className="text-sm text-muted tabular-nums">
            +{planIncome.toLocaleString("uk-UA")} ₴
          </div>
          <div className="text-sm text-muted tabular-nums">
            −{planExpense.toLocaleString("uk-UA")} ₴
          </div>
          <div className="text-sm text-muted tabular-nums">
            {planSavings.toLocaleString("uk-UA")} ₴ збер.
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-subtle/60 mb-1">Факт</div>
          <div className="text-sm text-success tabular-nums">
            +{income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
          </div>
          <div className="text-sm text-danger tabular-nums">
            −{spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
          </div>
          <div
            className={cn(
              "text-sm tabular-nums",
              factSavings >= 0 ? "text-success" : "text-danger",
            )}
          >
            {factSavings.toLocaleString("uk-UA", {
              maximumFractionDigits: 0,
            })}{" "}
            ₴ збер.
          </div>
        </div>
      </div>
    </Card>
  );
}
