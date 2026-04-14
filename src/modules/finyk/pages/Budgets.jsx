import { useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import {
  calcCategorySpent,
  getTxStatAmount,
  resolveExpenseCategoryMeta,
} from "../utils";
import { mergeExpenseCategoryDefinitions } from "../constants";
import { cn } from "@shared/lib/cn";

const formInp =
  "w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary";

export function Budgets({ mono, storage }) {
  const { realTx, loadingTx } = mono;
  const {
    budgets,
    setBudgets,
    excludedTxIds,
    monthlyPlan,
    setMonthlyPlan,
    txCategories,
    txSplits,
    customCategories,
  } = storage;
  const statTx = realTx.filter((t) => !excludedTxIds.has(t.id));
  const [editIdx, setEditIdx] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("limit");
  const [newB, setNewB] = useState({
    type: "limit",
    categoryId: "",
    limit: "",
    name: "",
    emoji: "🎯",
    targetAmount: "",
    targetDate: "",
    savedAmount: "",
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const expenseCategoryList = useMemo(
    () => mergeExpenseCategoryDefinitions(customCategories),
    [customCategories],
  );
  const calcSpent = (budget) =>
    calcCategorySpent(
      statTx,
      budget.categoryId,
      txCategories,
      txSplits,
      customCategories,
    );
  const limitBudgets = budgets.filter((b) => b.type === "limit");
  const goalBudgets = budgets.filter((b) => b.type === "goal");
  const planIncome = Number(monthlyPlan?.income || 0);
  const planExpense = Number(monthlyPlan?.expense || 0);
  const planSavings = Number(monthlyPlan?.savings || 0);

  const totalExpenseFact = useMemo(
    () =>
      Math.round(
        statTx
          .filter((t) => t.amount < 0)
          .reduce((s, t) => s + getTxStatAmount(t, txSplits), 0),
      ),
    [statTx, txSplits],
  );

  const addBudget = () => {
    if (newB.type === "limit" && newB.categoryId && newB.limit) {
      setBudgets((b) => [
        ...b,
        { ...newB, limit: Number(newB.limit), id: Date.now().toString() },
      ]);
      setNewB({
        type: "limit",
        categoryId: "",
        limit: "",
        name: "",
        emoji: "🎯",
        targetAmount: "",
        targetDate: "",
        savedAmount: "",
      });
      setShowForm(false);
    } else if (newB.type === "goal" && newB.name && newB.targetAmount) {
      setBudgets((b) => [
        ...b,
        {
          ...newB,
          targetAmount: Number(newB.targetAmount),
          savedAmount: Number(newB.savedAmount || 0),
          id: Date.now().toString(),
        },
      ]);
      setNewB({
        type: "limit",
        categoryId: "",
        limit: "",
        name: "",
        emoji: "🎯",
        targetAmount: "",
        targetDate: "",
        savedAmount: "",
      });
      setShowForm(false);
    }
  };

  if (loadingTx && realTx.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pt-4 page-tabbar-pad space-y-3 max-w-4xl mx-auto w-full">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-20 opacity-80 rounded-xl" />
        <Skeleton className="h-20 opacity-60 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        {/* Monthly plan */}
        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-[11px] font-bold text-subtle uppercase tracking-widest mb-3">
            Фінплан на місяць
          </div>
          <div className="space-y-2">
            <input
              className={formInp}
              type="number"
              placeholder="План доходу ₴"
              value={monthlyPlan?.income ?? ""}
              onChange={(e) =>
                setMonthlyPlan((p) => ({
                  ...(p || {}),
                  income: e.target.value,
                }))
              }
            />
            <input
              className={formInp}
              type="number"
              placeholder="План витрат ₴"
              value={monthlyPlan?.expense ?? ""}
              onChange={(e) =>
                setMonthlyPlan((p) => ({
                  ...(p || {}),
                  expense: e.target.value,
                }))
              }
            />
            <input
              className={formInp}
              type="number"
              placeholder="План накопичень ₴"
              value={monthlyPlan?.savings ?? ""}
              onChange={(e) =>
                setMonthlyPlan((p) => ({
                  ...(p || {}),
                  savings: e.target.value,
                }))
              }
            />
          </div>
          {(planIncome > 0 || planExpense > 0 || planSavings > 0) && (
            <div className="text-xs text-muted mt-3 pt-3 border-t border-line space-y-3">
              <div className="flex justify-between gap-2 flex-wrap">
                <span>
                  План: +{planIncome.toLocaleString("uk-UA")} / −
                  {planExpense.toLocaleString("uk-UA")} /{" "}
                  {planSavings.toLocaleString("uk-UA")} ₴
                </span>
              </div>
              {planExpense > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-subtle">
                    <span>Витрати: план / факт</span>
                    <span className="tabular-nums font-medium text-text">
                      {planExpense.toLocaleString("uk-UA")} ₴ /{" "}
                      {totalExpenseFact.toLocaleString("uk-UA")} ₴
                    </span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        totalExpenseFact > planExpense
                          ? "bg-danger"
                          : totalExpenseFact / planExpense >= 0.85
                            ? "bg-warning"
                            : "bg-emerald-500",
                      )}
                      style={{
                        width: `${Math.min(100, planExpense > 0 ? (totalExpenseFact / planExpense) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-subtle">
                    {totalExpenseFact <= planExpense
                      ? `Залишок до ліміту плану: ${(planExpense - totalExpenseFact).toLocaleString("uk-UA")} ₴`
                      : `Перевищення плану на ${(totalExpenseFact - planExpense).toLocaleString("uk-UA")} ₴`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Limits */}
        <div className="text-[11px] font-bold text-subtle uppercase tracking-widest">
          Ліміти · {monthStart.toLocaleDateString("uk-UA", { month: "long" })}
        </div>
        {limitBudgets.length === 0 && (
          <EmptyState
            compact
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            title="Немає лімітів"
            description="Встанови ліміт витрат на категорію, щоб не виходити за межі бюджету"
          />
        )}
        {limitBudgets.map((b, i) => {
          const cat = resolveExpenseCategoryMeta(
            b.categoryId,
            customCategories,
          );
          const bspent = calcSpent(b);
          const pctRaw = b.limit > 0 ? (bspent / b.limit) * 100 : 0;
          const pct = Math.min(100, Math.round(pctRaw));
          const overLimit = pctRaw >= 100;
          const warnLimit = pctRaw >= 80 && !overLimit;
          const remaining = Math.max(0, b.limit - bspent);
          const globalIdx = budgets.indexOf(b);
          const isEditing = editIdx === globalIdx;
          return (
            <div
              key={b.id || i}
              className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card"
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className={formInp}
                    type="number"
                    placeholder="Ліміт ₴"
                    value={b.limit}
                    onChange={(e) =>
                      setBudgets((bs) =>
                        bs.map((x, j) =>
                          j === globalIdx
                            ? { ...x, limit: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => setEditIdx(null)}
                    >
                      Зберегти
                    </Button>
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setBudgets((bs) =>
                          bs.filter((_, j) => j !== globalIdx),
                        );
                        setEditIdx(null);
                      }}
                    >
                      Видалити
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">
                      {cat?.label || "—"}
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
                        {bspent} / {b.limit} ₴
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditIdx(globalIdx)}
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
                      ? `Перевищено на ${(bspent - b.limit).toLocaleString("uk-UA")} ₴`
                      : `Залишок ${remaining.toLocaleString("uk-UA")} ₴ · ${pct}% використано`}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Goals */}
        <div className="text-[11px] font-bold text-subtle uppercase tracking-widest pt-1">
          Цілі накопичення
        </div>
        {goalBudgets.length === 0 && (
          <EmptyState
            compact
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            title="Немає цілей"
            description="Постав ціль накопичення і відстежуй прогрес"
          />
        )}
        {goalBudgets.map((b, i) => {
          const saved = b.savedAmount || 0;
          const pct = Math.min(
            100,
            b.targetAmount > 0 ? Math.round((saved / b.targetAmount) * 100) : 0,
          );
          const daysLeft = b.targetDate
            ? Math.ceil((new Date(b.targetDate) - now) / 86400000)
            : null;
          const globalIdx = budgets.indexOf(b);
          const isEditing = editIdx === globalIdx;
          return (
            <div
              key={b.id || i}
              className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card"
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className={formInp}
                    type="number"
                    placeholder="Відкладено ₴"
                    value={b.savedAmount || ""}
                    onChange={(e) =>
                      setBudgets((bs) =>
                        bs.map((x, j) =>
                          j === globalIdx
                            ? { ...x, savedAmount: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => setEditIdx(null)}
                    >
                      Зберегти
                    </Button>
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setBudgets((bs) =>
                          bs.filter((_, j) => j !== globalIdx),
                        );
                        setEditIdx(null);
                      }}
                    >
                      Видалити
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">
                      {b.emoji} {b.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {saved.toLocaleString("uk-UA")} /{" "}
                        {b.targetAmount.toLocaleString("uk-UA")} ₴
                      </span>
                      <button
                        onClick={() => setEditIdx(globalIdx)}
                        className="text-subtle hover:text-text text-sm transition-colors"
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
                  <div className="text-xs text-subtle mt-1.5">
                    {pct}% ·{" "}
                    {daysLeft !== null
                      ? daysLeft > 0
                        ? `${daysLeft} днів до мети`
                        : "⏰ Термін минув!"
                      : "Без дедлайну"}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Add form */}
        {showForm ? (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFormType("limit");
                  setNewB((b) => ({ ...b, type: "limit" }));
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
                  setFormType("goal");
                  setNewB((b) => ({ ...b, type: "goal" }));
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
                <select
                  className={formInp}
                  value={newB.categoryId}
                  onChange={(e) =>
                    setNewB((b) => ({ ...b, categoryId: e.target.value }))
                  }
                >
                  <option value="">Вибери категорію</option>
                  {expenseCategoryList
                    .filter((c) => c.id !== "income")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </select>
                <input
                  className={formInp}
                  placeholder="Ліміт ₴"
                  type="number"
                  value={newB.limit}
                  onChange={(e) =>
                    setNewB((b) => ({ ...b, limit: e.target.value }))
                  }
                />
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {[
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
                  ].map((e) => (
                    <button
                      key={e}
                      onClick={() => setNewB((b) => ({ ...b, emoji: e }))}
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
                    setNewB((b) => ({ ...b, name: e.target.value }))
                  }
                />
                <input
                  className={formInp}
                  placeholder="Сума цілі ₴"
                  type="number"
                  value={newB.targetAmount}
                  onChange={(e) =>
                    setNewB((b) => ({ ...b, targetAmount: e.target.value }))
                  }
                />
                <input
                  className={formInp}
                  placeholder="Вже відкладено ₴"
                  type="number"
                  value={newB.savedAmount}
                  onChange={(e) =>
                    setNewB((b) => ({ ...b, savedAmount: e.target.value }))
                  }
                />
                <input
                  className={formInp}
                  type="date"
                  value={newB.targetDate}
                  onChange={(e) =>
                    setNewB((b) => ({ ...b, targetDate: e.target.value }))
                  }
                />
              </>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={addBudget}>
                Додати
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Скасувати
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors"
          >
            + Додати бюджет або ціль
          </button>
        )}
      </div>
    </div>
  );
}
