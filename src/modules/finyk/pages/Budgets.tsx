import { useMemo, useState, useCallback } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { calcCategorySpent, resolveExpenseCategoryMeta } from "../utils";
import { buildExpenseCategoryList } from "../domain/categories";
import {
  getLimitBudgets,
  getGoalBudgets,
  calculateLimitUsage,
  calculateGoalProgress,
  getGoalMonthlyLabel,
  shouldShowProactiveAdvice,
  buildAtRiskKey,
  getCurrentMonthContext,
  getMonthlyPlanUsage,
  calculateTotalExpenseFact,
  validateLimitBudgetForm,
  validateGoalBudgetForm,
  type LimitFormInput,
  type GoalFormInput,
} from "../domain/budget";
import { filterStatTransactions } from "../domain/transactions";
import { calcForecast } from "../lib/forecastEngine";
import { chatApi } from "@shared/api";
import { finykKeys } from "@shared/lib/queryKeys.js";
import { LimitBudgetCard } from "../components/budgets/LimitBudgetCard.jsx";
import { GoalBudgetCard } from "../components/budgets/GoalBudgetCard.jsx";
import { MonthlyPlanCard } from "../components/budgets/MonthlyPlanCard.jsx";
import { BudgetForecastCard } from "../components/budgets/BudgetForecastCard.jsx";
import { AddBudgetForm } from "../components/budgets/AddBudgetForm.jsx";
import { CategoryManagerSection } from "../components/budgets/CategoryManagerSection.jsx";
import { readJSON, writeJSON } from "../lib/finykStorage.js";
import { trackEvent, ANALYTICS_EVENTS } from "../../../core/analytics";

// ─── React Query integration for AI chat lookups ──────────────────────────
//
// The Budgets page issues two kinds of AI requests:
//
//  1. **Proactive advice** (one request per at-risk category on the current
//     month) — eligible for a 24h cache backed by localStorage. The query is
//     keyed by `[monthKey, categoryId]` so the cache rolls over naturally
//     when the month changes.
//  2. **On-demand forecast explanation** (user clicks "Пояснити" on a
//     forecast card) — fired through `useMutation`. The text is stored in
//     per-category local state; we don't cache across sessions because the
//     button wording ("🔄 Пояснити знову") makes regeneration explicit.

const PROACTIVE_CACHE_PREFIX = "finyk_proactive_v1_";
const PROACTIVE_CACHE_TTL = 24 * 60 * 60 * 1000;

const proactiveCacheKey = (categoryId, monthKey) =>
  `${PROACTIVE_CACHE_PREFIX}${categoryId}_${monthKey}`;

// Re-export from the centralized queryKeys module for callers that still
// import this name from the Budgets page.
export const proactiveAdviceQueryKey = finykKeys.proactiveAdvice;

function loadProactiveAdviceFromLS(categoryId, monthKey) {
  const cached = readJSON(proactiveCacheKey(categoryId, monthKey), null);
  if (!cached || typeof cached !== "object") return null;
  const { text, ts } = cached;
  if (!text || !ts || Date.now() - ts > PROACTIVE_CACHE_TTL) return null;
  return { text, ts };
}

function saveProactiveAdviceToLS(categoryId, monthKey, text) {
  writeJSON(proactiveCacheKey(categoryId, monthKey), {
    text,
    ts: Date.now(),
  });
}

async function fetchProactiveAdvice({
  categoryId,
  monthKey,
  catLabel,
  spent,
  limit,
  remaining,
  pct,
  forecast,
  forecastNote,
  daysRemaining,
}) {
  const prompt = `Категорія бюджету: ${catLabel}. Витрачено: ${spent.toLocaleString(
    "uk-UA",
  )} ₴ (${pct}% від ліміту ${limit.toLocaleString(
    "uk-UA",
  )} ₴). Залишок: ${remaining.toLocaleString(
    "uk-UA",
  )} ₴. До кінця місяця ${daysRemaining} днів.${forecastNote} Дай конкретну коротку пораду (1-2 речення) що зробити, щоб не перевищити ліміт. Відповідь виключно українською.`;
  const data = await chatApi.send({
    context: `[Проактивна AI-порада] Категорія: ${catLabel}, витрачено: ${spent} ₴, ліміт: ${limit} ₴, залишок: ${remaining} ₴, прогноз: ${
      forecast ?? "—"
    } ₴, днів до кінця місяця: ${daysRemaining}`,
    messages: [{ role: "user", content: prompt }],
  });
  const text = data.text || null;
  if (text) saveProactiveAdviceToLS(categoryId, monthKey, text);
  return text;
}

interface ExplainVars {
  categoryId: string;
  catLabel: string;
  spent: number;
  forecast: number;
  limit: number;
}

async function fetchCategoryExplanation({
  catLabel,
  spent,
  forecast,
  limit,
}: Omit<ExplainVars, "categoryId">) {
  const prompt = `Категорія: ${catLabel}. Витрачено за місяць: ${spent} ₴. Прогноз на кінець місяця: ${forecast} ₴. Ліміт: ${limit} ₴. Чому витрати можуть бути ${
    forecast > limit ? "вищими за ліміт" : "нижчими за план"
  } і що варто зробити? Дай коротку відповідь (2-3 речення) українською.`;
  const data = await chatApi.send({
    context: `[Бюджетний прогноз] Категорія: ${catLabel}, витрачено: ${spent} ₴, прогноз: ${forecast} ₴, ліміт: ${limit} ₴`,
    messages: [{ role: "user", content: prompt }],
  });
  return data.text || "Не вдалося отримати пояснення.";
}

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
    addCustomCategory,
    editCustomCategory,
    removeCustomCategory,
  } = storage;
  const statTx = useMemo(
    () => filterStatTransactions(realTx, excludedTxIds),
    [realTx, excludedTxIds],
  );
  const [editIdx, setEditIdx] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
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

  const now = useMemo(() => new Date(), []);
  const { monthStart } = getCurrentMonthContext(now);
  const expenseCategoryList = useMemo(
    () => buildExpenseCategoryList(customCategories, { excludeIncome: false }),
    [customCategories],
  );
  const calcSpent = useCallback(
    (budget) =>
      calcCategorySpent(
        statTx,
        budget.categoryId,
        txCategories,
        txSplits,
        customCategories,
      ),
    [customCategories, statTx, txCategories, txSplits],
  );
  const limitBudgets = useMemo(() => getLimitBudgets(budgets), [budgets]);
  const goalBudgets = useMemo(() => getGoalBudgets(budgets), [budgets]);
  const planIncome = Number(monthlyPlan?.income || 0);
  const planExpense = Number(monthlyPlan?.expense || 0);

  const totalExpenseFact = useMemo(
    () => calculateTotalExpenseFact(statTx, txSplits),
    [statTx, txSplits],
  );

  const [formError, setFormError] = useState("");

  const [aiExplanations, setAiExplanations] = useState({});

  const forecasts = useMemo(() => {
    if (limitBudgets.length === 0) return [];
    return calcForecast(
      statTx,
      limitBudgets,
      now,
      txCategories,
      txSplits,
      customCategories,
    );
  }, [statTx, limitBudgets, now, txCategories, txSplits, customCategories]);

  const atRiskKey = useMemo(
    () => buildAtRiskKey(forecasts, now),
    [forecasts, now],
  );

  // Derive the exact set of (monthKey, categoryId) pairs that need proactive
  // advice, along with the prompt context for each. The resulting array drives
  // `useQueries` below, so a category entering/leaving the at-risk set just
  // adds/removes an observer — no manual fetch orchestration needed.
  const proactiveItems = useMemo(() => {
    if (!atRiskKey) return [];
    const [monthKey, idsStr] = atRiskKey.split("|");
    if (!monthKey) return [];
    const atRiskIds = idsStr ? idsStr.split(",").filter(Boolean) : [];
    if (atRiskIds.length === 0) return [];
    const forecastByCategory = {};
    for (const fc of forecasts) forecastByCategory[fc.categoryId] = fc;
    const { daysLeft: daysRemaining } = getCurrentMonthContext(now);
    const items = [];
    for (const categoryId of atRiskIds) {
      const b = limitBudgets.find((x) => x.categoryId === categoryId);
      if (!b) continue;
      const cat = resolveExpenseCategoryMeta(categoryId, customCategories);
      const catLabel = cat?.label || categoryId;
      const spent = calcSpent(b);
      const remaining = Math.max(0, b.limit - spent);
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      const fc = forecastByCategory[categoryId];
      const forecastNote = fc
        ? ` Прогноз на кінець місяця: ${fc.forecast.toLocaleString("uk-UA")} ₴ (${fc.overLimit ? `перевищення на ${fc.overPercent}%` : "в межах ліміту"}).`
        : "";
      items.push({
        categoryId,
        monthKey,
        catLabel,
        spent,
        limit: b.limit,
        remaining,
        pct,
        forecast: fc?.forecast,
        forecastNote,
        daysRemaining,
      });
    }
    return items;
  }, [atRiskKey, limitBudgets, forecasts, customCategories, calcSpent, now]);

  // One query per at-risk category. Seeded synchronously from localStorage so
  // the UI paints cached advice with no spinner. `staleTime` is set to the
  // 24h TTL and `initialDataUpdatedAt` is the LS timestamp, so a cached entry
  // older than a day is considered stale and re-fetched automatically —
  // matching the pre-migration manual TTL check.
  const proactiveQueries = useQueries({
    queries: proactiveItems.map((item) => ({
      queryKey: proactiveAdviceQueryKey(item.monthKey, item.categoryId),
      queryFn: () => fetchProactiveAdvice(item),
      staleTime: PROACTIVE_CACHE_TTL,
      gcTime: PROACTIVE_CACHE_TTL,
      retry: false,
      initialData: () => {
        const cached = loadProactiveAdviceFromLS(
          item.categoryId,
          item.monthKey,
        );
        return cached?.text ?? undefined;
      },
      initialDataUpdatedAt: () => {
        const cached = loadProactiveAdviceFromLS(
          item.categoryId,
          item.monthKey,
        );
        return cached?.ts ?? undefined;
      },
    })),
  });

  const proactiveAdvice = {};
  const proactiveLoading = {};
  proactiveItems.forEach((item, i) => {
    const q = proactiveQueries[i];
    proactiveAdvice[item.categoryId] = q?.data ?? null;
    proactiveLoading[item.categoryId] = Boolean(q?.isFetching);
  });

  // On-demand explanation: single shared mutation, per-category result stored
  // in local state so each forecast card renders independently. `variables`
  // carries the categoryId so we can derive per-card loading state from
  // `mutation.isPending && mutation.variables?.categoryId === fc.categoryId`.
  const explainMutation = useMutation<string | null, Error, ExplainVars>({
    mutationFn: ({ catLabel, spent, forecast, limit }) =>
      fetchCategoryExplanation({ catLabel, spent, forecast, limit }),
    onSuccess: (text, { categoryId }) => {
      setAiExplanations((prev) => ({ ...prev, [categoryId]: text }));
    },
    onError: (_err, { categoryId }) => {
      setAiExplanations((prev) => ({
        ...prev,
        [categoryId]: "Помилка з'єднання з AI.",
      }));
    },
  });

  const isExplaining = useCallback(
    (categoryId) =>
      explainMutation.isPending &&
      explainMutation.variables?.categoryId === categoryId,
    [explainMutation.isPending, explainMutation.variables],
  );

  const explainCategory = useCallback(
    (categoryId, catLabel, spent, forecast, limit) => {
      if (isExplaining(categoryId)) return;
      setAiExplanations((prev) => ({ ...prev, [categoryId]: null }));
      explainMutation.mutate({
        categoryId,
        catLabel,
        spent,
        forecast,
        limit,
      });
    },
    [explainMutation, isExplaining],
  );

  const resetForm = () => {
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
    setFormType("limit");
    setFormError("");
    setShowForm(false);
  };

  const addBudget = () => {
    setFormError("");
    const { error, normalized } =
      newB.type === "limit"
        ? validateLimitBudgetForm(newB as LimitFormInput, budgets)
        : validateGoalBudgetForm(newB as GoalFormInput);
    if (error || !normalized) {
      setFormError(error || "Помилка валідації");
      return;
    }
    setBudgets((b) => [...b, { ...normalized, id: crypto.randomUUID() }]);
    trackEvent(
      ANALYTICS_EVENTS.BUDGET_SET,
      normalized.type === "limit"
        ? { type: "limit", categoryId: normalized.categoryId }
        : { type: "goal" },
    );
    resetForm();
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

  const {
    remaining: remaining2,
    safePerDay,
    pctExpense,
    isOver,
    daysLeft: daysLeft2,
  } = getMonthlyPlanUsage(
    { planIncome, planExpense, totalFact: totalExpenseFact },
    new Date(),
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <MonthlyPlanCard
          monthlyPlan={monthlyPlan}
          onChangeMonthlyPlan={setMonthlyPlan}
          planIncome={planIncome}
          planExpense={planExpense}
          totalExpenseFact={totalExpenseFact}
          remaining={remaining2}
          safePerDay={safePerDay}
          pctExpense={pctExpense}
          isOver={isOver}
          daysLeft={daysLeft2}
        />

        {/* Limits */}
        <SectionHeading as="div" size="sm">
          Ліміти · {monthStart.toLocaleDateString("uk-UA", { month: "long" })}
        </SectionHeading>
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
          const usage = calculateLimitUsage(b, bspent);
          const globalIdx = budgets.indexOf(b);
          const forecastForCat = forecasts.find(
            (fc) => fc.categoryId === b.categoryId,
          );
          const showAdvice = shouldShowProactiveAdvice(usage, forecastForCat);
          const isEditing = editIdx === globalIdx;
          return (
            <LimitBudgetCard
              key={b.id || i}
              budget={b}
              categoryLabel={cat?.label || "—"}
              spent={usage.spent}
              pctRaw={usage.pctRaw}
              pctRounded={usage.pctRounded}
              remaining={usage.remaining}
              isEditing={isEditing}
              showProactiveAdvice={showAdvice}
              proactiveText={proactiveAdvice[b.categoryId]}
              proactiveLoading={proactiveLoading[b.categoryId]}
              onBeginEdit={() => setEditIdx(globalIdx)}
              onChangeLimit={(nextLimit) =>
                setBudgets((bs) =>
                  bs.map((x, j) =>
                    j === globalIdx ? { ...x, limit: Number(nextLimit) } : x,
                  ),
                )
              }
              onSave={() => setEditIdx(null)}
              onDelete={() => {
                setBudgets((bs) => bs.filter((_, j) => j !== globalIdx));
                setEditIdx(null);
              }}
            />
          );
        })}

        {/* Forecast — shown whenever there are limit budgets to avoid layout shifts */}
        {limitBudgets.length > 0 && (
          <>
            <SectionHeading as="div" size="sm" className="pt-1">
              Прогноз · кінець місяця
            </SectionHeading>
            {loadingTx && forecasts.length === 0 ? (
              limitBudgets.map((b) => (
                <Skeleton key={b.id} className="h-64 rounded-2xl" />
              ))
            ) : forecasts.length === 0 ? (
              <div className="text-sm text-muted px-1">
                Недостатньо даних для прогнозу
              </div>
            ) : null}
            {forecasts.map((fc) => {
              const cat = resolveExpenseCategoryMeta(
                fc.categoryId,
                customCategories,
              );
              const label = cat?.label || fc.categoryId;
              return (
                <BudgetForecastCard
                  key={fc.categoryId}
                  forecast={fc}
                  categoryLabel={label}
                  explanation={aiExplanations[fc.categoryId]}
                  loading={isExplaining(fc.categoryId)}
                  onExplain={() =>
                    explainCategory(
                      fc.categoryId,
                      label,
                      fc.spent,
                      fc.forecast,
                      fc.limit,
                    )
                  }
                />
              );
            })}
          </>
        )}

        {/* Goals */}
        <SectionHeading as="div" size="sm" className="pt-1">
          Цілі накопичення
        </SectionHeading>
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
          const progress = calculateGoalProgress(b, now);
          const globalIdx = budgets.indexOf(b);
          const isEditing = editIdx === globalIdx;
          return (
            <GoalBudgetCard
              key={b.id || i}
              budget={b}
              saved={progress.saved}
              pct={progress.pct}
              daysLeft={progress.daysLeft}
              monthlyLabel={getGoalMonthlyLabel(progress)}
              isEditing={isEditing}
              onBeginEdit={() => setEditIdx(globalIdx)}
              onChangeSaved={(nextSaved) =>
                setBudgets((bs) =>
                  bs.map((x, j) =>
                    j === globalIdx
                      ? { ...x, savedAmount: Number(nextSaved) }
                      : x,
                  ),
                )
              }
              onSave={() => setEditIdx(null)}
              onDelete={() => {
                setBudgets((bs) => bs.filter((_, j) => j !== globalIdx));
                setEditIdx(null);
              }}
            />
          );
        })}

        {showForm ? (
          <AddBudgetForm
            formType={formType}
            newB={newB}
            onChangeFormType={setFormType}
            onChangeNewB={setNewB}
            expenseCategoryList={expenseCategoryList}
            formError={formError}
            onSubmit={addBudget}
            onCancel={resetForm}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors"
          >
            + Додати бюджет або ціль
          </button>
        )}

        <CategoryManagerSection
          open={showCategories}
          onToggle={() => setShowCategories((v) => !v)}
          customCategories={customCategories}
          allCategories={expenseCategoryList}
          onAdd={addCustomCategory}
          onEdit={editCustomCategory}
          onRemove={removeCustomCategory}
        />
      </div>
    </div>
  );
}
