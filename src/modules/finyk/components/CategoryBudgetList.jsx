import { cn } from "@shared/lib/cn";

export function CategoryBudgetList({ budgets = [], onBudgetClick }) {
  if (budgets.length === 0) return null;

  return (
    <div className="space-y-2">
      {budgets.map((b) => {
        const { label, spent, pct, remaining, isOver } = b;
        const barColor = isOver
          ? "bg-danger"
          : pct >= 85
            ? "bg-warning"
            : "bg-emerald-500";

        return (
          <button
            key={b.categoryId || b.id}
            type="button"
            className="w-full bg-panel border border-line/60 rounded-2xl px-4 py-3 shadow-card text-left transition-colors hover:border-line active:bg-panelHi"
            onClick={() => onBudgetClick?.(b)}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-text truncate pr-2">
                {label}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    isOver ? "text-danger" : pct >= 85 ? "text-warning" : "text-muted",
                  )}
                >
                  {pct}%
                </span>
              </div>
            </div>

            <div className="h-1.5 bg-bg rounded-full overflow-hidden mb-1.5">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-subtle tabular-nums">
              <span>
                {spent.toLocaleString("uk-UA")} ₴ з{" "}
                {b.limit.toLocaleString("uk-UA")} ₴
              </span>
              <span className={cn(isOver ? "text-danger" : "")}>
                {isOver
                  ? `−${Math.abs(remaining).toLocaleString("uk-UA")} ₴`
                  : `залишок ${remaining.toLocaleString("uk-UA")} ₴`}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
