import { memo } from "react";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { cn } from "@shared/lib/cn";
import { CategorySelector } from "../CategorySelector.jsx";

const formInp =
  "w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary";

const GOAL_EMOJIS = [
  "🎯",
  "🏠",
  "🚗",
  "✈️",
  "💻",
  "📱",
  "💍",
  "🎓",
  "🏋️",
  "💰",
];

// Form for creating a new limit or goal budget. State is lifted to parent
// (Budgets.jsx) so that form submission can access the full `budgets` array
// for validation (e.g. dedupe by category).
function AddBudgetFormComponent({
  formType,
  newB,
  onChangeFormType,
  onChangeNewB,
  expenseCategoryList,
  formError,
  onSubmit,
  onCancel,
}) {
  return (
    <Card radius="lg" padding="lg" className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => {
            onChangeFormType("limit");
            onChangeNewB((b) => ({ ...b, type: "limit" }));
          }}
          className={cn(
            "flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors",
            formType === "limit"
              ? "bg-primary border-primary text-white"
              : "border-line text-subtle",
          )}
        >
          🔴 Ліміт
        </button>
        <button
          onClick={() => {
            onChangeFormType("goal");
            onChangeNewB((b) => ({ ...b, type: "goal" }));
          }}
          className={cn(
            "flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors",
            formType === "goal"
              ? "bg-success border-success text-white"
              : "border-line text-subtle",
          )}
        >
          🟢 Ціль
        </button>
      </div>
      {formType === "limit" ? (
        <>
          <CategorySelector
            value={newB.categoryId}
            onChange={(val) => onChangeNewB((b) => ({ ...b, categoryId: val }))}
            categories={expenseCategoryList.filter((c) => c.id !== "income")}
            placeholder="Вибери категорію"
          />
          <input
            className={formInp}
            placeholder="Ліміт ₴"
            type="number"
            value={newB.limit}
            onChange={(e) =>
              onChangeNewB((b) => ({ ...b, limit: e.target.value }))
            }
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {GOAL_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => onChangeNewB((b) => ({ ...b, emoji: e }))}
                className={cn(
                  "text-xl p-1.5 rounded-lg border transition-colors",
                  newB.emoji === e
                    ? "border-primary bg-primary/10"
                    : "border-transparent",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            className={formInp}
            placeholder="Назва цілі"
            value={newB.name}
            onChange={(e) =>
              onChangeNewB((b) => ({ ...b, name: e.target.value }))
            }
          />
          <input
            className={formInp}
            placeholder="Сума цілі ₴"
            type="number"
            value={newB.targetAmount}
            onChange={(e) =>
              onChangeNewB((b) => ({ ...b, targetAmount: e.target.value }))
            }
          />
          <input
            className={formInp}
            placeholder="Вже відкладено ₴"
            type="number"
            value={newB.savedAmount}
            onChange={(e) =>
              onChangeNewB((b) => ({ ...b, savedAmount: e.target.value }))
            }
          />
          <input
            className={formInp}
            type="date"
            value={newB.targetDate}
            onChange={(e) =>
              onChangeNewB((b) => ({ ...b, targetDate: e.target.value }))
            }
          />
        </>
      )}
      {formError && (
        <p className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" size="sm" onClick={onSubmit}>
          Додати
        </Button>
        <Button className="flex-1" size="sm" variant="ghost" onClick={onCancel}>
          Скасувати
        </Button>
      </div>
    </Card>
  );
}

export const AddBudgetForm = memo(AddBudgetFormComponent);
