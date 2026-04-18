import { memo } from "react";
import { Button } from "@shared/components/ui/Button";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { cn } from "@shared/lib/cn";

const formInp =
  "w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary";

// Презентаційна картка ліміту бюджету. Усі дані приходять готовими пропсами,
// тому memo потрібен, щоб картка не перемальовувалась при змінах сусідніх
// бюджетів чи сторонніх станів Budgets.
function LimitBudgetCardComponent({
  budget,
  categoryLabel,
  spent,
  pctRaw,
  pctRounded,
  remaining,
  isEditing,
  showProactiveAdvice,
  proactiveText,
  proactiveLoading,
  onBeginEdit,
  onChangeLimit,
  onSave,
  onDelete,
}) {
  const overLimit = pctRaw >= 100;
  const warnLimit = pctRaw >= 80 && !overLimit;

  return (
    <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
      {isEditing ? (
        <div className="space-y-2">
          <input
            className={formInp}
            type="number"
            placeholder="Ліміт ₴"
            value={budget.limit}
            onChange={(e) => onChangeLimit?.(Number(e.target.value))}
          />
          <div className="flex gap-2">
            <Button className="flex-1" size="sm" onClick={onSave}>
              Зберегти
            </Button>
            <Button
              className="flex-1"
              size="sm"
              variant="danger"
              onClick={onDelete}
            >
              Видалити
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold">
              {categoryLabel || "—"}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overLimit
                    ? "text-danger font-semibold"
                    : warnLimit
                      ? "text-warning"
                      : "text-muted",
                )}
              >
                {spent} / {budget.limit} ₴
              </span>
              <button
                type="button"
                onClick={onBeginEdit}
                className="text-subtle hover:text-text text-sm transition-colors"
                aria-label="Редагувати ліміт"
              >
                ✏️
              </button>
            </div>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                overLimit
                  ? "bg-danger"
                  : warnLimit
                    ? "bg-warning"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, pctRaw)}%` }}
            />
          </div>
          <div
            className={cn(
              "text-xs mt-2",
              overLimit
                ? "text-danger font-medium"
                : warnLimit
                  ? "text-warning"
                  : "text-subtle",
            )}
          >
            {overLimit
              ? `Перевищено на ${(spent - budget.limit).toLocaleString("uk-UA")} ₴`
              : `Залишок ${remaining.toLocaleString("uk-UA")} ₴ · ${pctRounded}% використано`}
          </div>

          {showProactiveAdvice &&
            (proactiveText || proactiveLoading !== false) && (
              <div className="mt-3 bg-bg rounded-xl px-3 py-2.5 min-h-[3.5rem]">
                {proactiveText ? (
                  <div className="flex gap-2 items-start">
                    <span className="text-base leading-none mt-0.5 shrink-0">
                      ✨
                    </span>
                    <p className="text-xs text-text leading-relaxed">
                      {proactiveText}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5" aria-busy="true">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-4/5 rounded" />
                  </div>
                )}
              </div>
            )}
        </>
      )}
    </div>
  );
}

export const LimitBudgetCard = memo(LimitBudgetCardComponent);
