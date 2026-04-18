import { memo } from "react";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";

const formInp =
  "w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary";

// Картка цілі накопичення — детерміновані пропси, memo дозволяє не
// перераховувати розмітку при перерендерах сторінки Budgets.
function GoalBudgetCardComponent({
  budget,
  saved,
  pct,
  daysLeft,
  monthlyLabel,
  isEditing,
  onBeginEdit,
  onChangeSaved,
  onSave,
  onDelete,
}) {
  return (
    <Card radius="lg" padding="lg">
      {isEditing ? (
        <div className="space-y-2">
          <input
            className={formInp}
            type="number"
            placeholder="Відкладено ₴"
            value={budget.savedAmount || ""}
            onChange={(e) => onChangeSaved?.(Number(e.target.value))}
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
              {budget.emoji} {budget.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {saved.toLocaleString("uk-UA")} /{" "}
                {budget.targetAmount.toLocaleString("uk-UA")} ₴
              </span>
              <button
                type="button"
                onClick={onBeginEdit}
                className="text-subtle hover:text-text text-sm transition-colors"
                aria-label="Редагувати ціль"
              >
                ✏️
              </button>
            </div>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {monthlyLabel && (
            <div className="text-xs text-subtle mt-1.5">{monthlyLabel}</div>
          )}
          <div className="text-xs text-subtle mt-0.5">
            {pct}% ·{" "}
            {daysLeft !== null
              ? daysLeft > 0
                ? `${daysLeft} днів до мети`
                : "⏰ Термін минув!"
              : "Без дедлайну"}
          </div>
        </>
      )}
    </Card>
  );
}

export const GoalBudgetCard = memo(GoalBudgetCardComponent);
