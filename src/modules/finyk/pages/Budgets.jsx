import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@shared/components/ui/Button";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import {
  calcCategorySpent,
  getTxStatAmount,
  resolveExpenseCategoryMeta,
  calcMonthlyNeeded,
} from "../utils";
import { mergeExpenseCategoryDefinitions } from "../constants";
import { cn } from "@shared/lib/cn";
import { calcForecast } from "../lib/forecastEngine";
import { BudgetTrendChart } from "../components/BudgetTrendChart";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { LimitBudgetCard } from "../components/budgets/LimitBudgetCard.jsx";
import { GoalBudgetCard } from "../components/budgets/GoalBudgetCard.jsx";
import { CategorySelector } from "../components/CategorySelector.jsx";
import { CategoryManager } from "../components/CategoryManager.jsx";
import { calculateSafeToSpendPerDay } from "../hooks/useBudget.js";

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
    addCustomCategory,
    editCustomCategory,
    removeCustomCategory,
  } = storage;
  const statTx = realTx.filter((t) => !excludedTxIds.has(t.id));
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const expenseCategoryList = useMemo(
    () => mergeExpenseCategoryDefinitions(customCategories),
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
  const limitBudgets = useMemo(
    () => budgets.filter((b) => b.type === "limit"),
    [budgets],
  );
  const goalBudgets = useMemo(
    () => budgets.filter((b) => b.type === "goal"),
    [budgets],
  );
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

  const [formError, setFormError] = useState("");

  const [aiExplanations, setAiExplanations] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  const [proactiveAdvice, setProactiveAdvice] = useState({});
  const [proactiveLoading, setProactiveLoading] = useState({});
  const fetchedInSession = useRef(new Set());

  const PROACTIVE_CACHE_PREFIX = "finyk_proactive_v1_";
  const PROACTIVE_CACHE_TTL = 24 * 60 * 60 * 1000;

  const getAdviceCache = useCallback(
    (categoryId, monthKey) => {
      try {
        const raw = localStorage.getItem(
          PROACTIVE_CACHE_PREFIX + categoryId + "_" + monthKey,
        );
        if (!raw) return null;
        const { text, ts } = JSON.parse(raw);
        if (Date.now() - ts > PROACTIVE_CACHE_TTL) return null;
        return text;
      } catch {
        return null;
      }
    },
    [PROACTIVE_CACHE_TTL],
  );

  const setAdviceCache = useCallback((categoryId, monthKey, text) => {
    try {
      localStorage.setItem(
        PROACTIVE_CACHE_PREFIX + categoryId + "_" + monthKey,
        JSON.stringify({ text, ts: Date.now() }),
      );
    } catch {}
  }, []);

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

  const atRiskKey = useMemo(() => {
    if (forecasts.length === 0) return "";
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const ids = forecasts
      .filter(
        (fc) => fc.overLimit || (fc.limit > 0 && fc.spent / fc.limit >= 0.8),
      )
      .map((fc) => fc.categoryId)
      .sort();
    return ids.length > 0 ? `${monthKey}|${ids.join(",")}` : "";
  }, [forecasts, now]);

  useEffect(() => {
    if (!atRiskKey) return;

    const [monthKey, idsStr] = atRiskKey.split("|");
    const atRiskIds = idsStr ? idsStr.split(",").filter(Boolean) : [];

    const forecastByCategory = {};
    for (const fc of forecasts) forecastByCategory[fc.categoryId] = fc;

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    const toFetch = [];
    const preloaded = {};

    for (const categoryId of atRiskIds) {
      const sessionKey = `${monthKey}:${categoryId}`;
      if (fetchedInSession.current.has(sessionKey)) continue;
      const cached = getAdviceCache(categoryId, monthKey);
      if (cached) {
        preloaded[categoryId] = cached;
        fetchedInSession.current.add(sessionKey);
      } else {
        toFetch.push(categoryId);
      }
    }

    if (Object.keys(preloaded).length > 0) {
      setProactiveAdvice((prev) => ({ ...prev, ...preloaded }));
    }

    if (toFetch.length === 0) return;

    for (const id of toFetch) fetchedInSession.current.add(`${monthKey}:${id}`);

    const loadingMap = {};
    for (const id of toFetch) loadingMap[id] = true;
    setProactiveLoading((prev) => ({ ...prev, ...loadingMap }));

    Promise.all(
      toFetch.map(async (categoryId) => {
        const b = limitBudgets.find((x) => x.categoryId === categoryId);
        if (!b) return;
        const cat = resolveExpenseCategoryMeta(categoryId, customCategories);
        const catLabel = cat?.label || categoryId;
        const spent = calcSpent(b);
        const remaining = Math.max(0, b.limit - spent);
        const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
        const fc = forecastByCategory[categoryId];
        const forecastNote = fc
          ? ` Прогноз на кінець місяця: ${fc.forecast.toLocaleString("uk-UA")} ₴ (${fc.overLimit ? `перевищення на ${fc.overPercent}%` : "в межах ліміту"}).`
          : "";
        const prompt = `Категорія бюджету: ${catLabel}. Витрачено: ${spent.toLocaleString("uk-UA")} ₴ (${pct}% від ліміту ${b.limit.toLocaleString("uk-UA")} ₴). Залишок: ${remaining.toLocaleString("uk-UA")} ₴. До кінця місяця ${daysRemaining} днів.${forecastNote} Дай конкретну коротку пораду (1-2 речення) що зробити, щоб не перевищити ліміт. Відповідь виключно українською.`;
        try {
          const res = await fetch(apiUrl("/api/chat"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: `[Проактивна AI-порада] Категорія: ${catLabel}, витрачено: ${spent} ₴, ліміт: ${b.limit} ₴, залишок: ${remaining} ₴, прогноз: ${fc?.forecast ?? "—"} ₴, днів до кінця місяця: ${daysRemaining}`,
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const text = data.text || null;
          if (text) {
            setAdviceCache(categoryId, monthKey, text);
            setProactiveAdvice((prev) => ({ ...prev, [categoryId]: text }));
          }
        } catch {
          fetchedInSession.current.delete(`${monthKey}:${categoryId}`);
        } finally {
          setProactiveLoading((prev) => ({ ...prev, [categoryId]: false }));
        }
      }),
    );
  }, [
    atRiskKey,
    calcSpent,
    customCategories,
    forecasts,
    getAdviceCache,
    limitBudgets,
    now,
    setAdviceCache,
  ]);

  const explainCategory = async (
    categoryId,
    catLabel,
    spent,
    forecast,
    limit,
  ) => {
    if (aiLoading[categoryId]) return;
    setAiLoading((prev) => ({ ...prev, [categoryId]: true }));
    setAiExplanations((prev) => ({ ...prev, [categoryId]: null }));
    try {
      const prompt = `Категорія: ${catLabel}. Витрачено за місяць: ${spent} ₴. Прогноз на кінець місяця: ${forecast} ₴. Ліміт: ${limit} ₴. Чому витрати можуть бути ${forecast > limit ? "вищими за ліміт" : "нижчими за план"} і що варто зробити? Дай коротку відповідь (2-3 речення) українською.`;
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: `[Бюджетний прогноз] Категорія: ${catLabel}, витрачено: ${spent} ₴, прогноз: ${forecast} ₴, ліміт: ${limit} ₴`,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAiExplanations((prev) => ({
        ...prev,
        [categoryId]: data.text || "Не вдалося отримати пояснення.",
      }));
    } catch {
      setAiExplanations((prev) => ({
        ...prev,
        [categoryId]: "Помилка з'єднання з AI.",
      }));
    } finally {
      setAiLoading((prev) => ({ ...prev, [categoryId]: false }));
    }
  };

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
    setFormError("");
    setShowForm(false);
  };

  const addBudget = () => {
    setFormError("");
    if (newB.type === "limit") {
      if (!newB.categoryId) {
        setFormError("Оберіть категорію");
        return;
      }
      const limitVal = Number(newB.limit);
      if (!newB.limit || isNaN(limitVal) || limitVal <= 0) {
        setFormError("Вкажіть ліміт більше 0");
        return;
      }
      if (
        budgets.some(
          (b) => b.type === "limit" && b.categoryId === newB.categoryId,
        )
      ) {
        setFormError("Ліміт для цієї категорії вже існує");
        return;
      }
      setBudgets((b) => [
        ...b,
        { ...newB, limit: limitVal, id: crypto.randomUUID() },
      ]);
      resetForm();
    } else if (newB.type === "goal") {
      if (!newB.name || !newB.name.trim()) {
        setFormError("Вкажіть назву цілі");
        return;
      }
      const targetVal = Number(newB.targetAmount);
      if (!newB.targetAmount || isNaN(targetVal) || targetVal <= 0) {
        setFormError("Вкажіть суму цілі більше 0");
        return;
      }
      const savedVal = Number(newB.savedAmount || 0);
      if (savedVal < 0) {
        setFormError("Відкладена сума не може бути від'ємною");
        return;
      }
      setBudgets((b) => [
        ...b,
        {
          ...newB,
          targetAmount: targetVal,
          savedAmount: savedVal,
          id: crypto.randomUUID(),
        },
      ]);
      resetForm();
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

  const now2 = new Date();
  const daysInMonth2 = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).getDate();
  const daysLeft2 = daysInMonth2 - now2.getDate();
  const remaining2 = Math.max(0, planExpense - totalExpenseFact);
  const safePerDay = calculateSafeToSpendPerDay(remaining2, daysLeft2);
  const pctExpense = planExpense > 0
    ? Math.min(100, Math.round((totalExpenseFact / planExpense) * 100))
    : 0;
  const isOver = planExpense > 0 && totalExpenseFact > planExpense;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        {/* Merged monthly plan block */}
        <div
          className={cn(
            "bg-panel border rounded-2xl p-5 shadow-card",
            isOver ? "border-danger/40" : "border-line/60",
          )}
        >
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
                setMonthlyPlan((p) => ({ ...(p || {}), income: e.target.value }))
              }
            />
            <input
              className={formInp}
              type="number"
              placeholder="План витрат ₴"
              value={monthlyPlan?.expense ?? ""}
              onChange={(e) =>
                setMonthlyPlan((p) => ({ ...(p || {}), expense: e.target.value }))
              }
            />
            <input
              className={formInp}
              type="number"
              placeholder="План накопичень ₴"
              value={monthlyPlan?.savings ?? ""}
              onChange={(e) =>
                setMonthlyPlan((p) => ({ ...(p || {}), savings: e.target.value }))
              }
            />
          </div>

          {(planIncome > 0 || planExpense > 0) && (
            <div className="mt-4 pt-4 border-t border-line space-y-3">
              {/* Fact row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-subtle mb-0.5">Дохід (план)</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {planIncome > 0 ? `${planIncome.toLocaleString("uk-UA")} ₴` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-subtle mb-0.5">Витрати (факт)</div>
                  <div className={cn("text-sm font-semibold tabular-nums", isOver ? "text-danger" : "")}>
                    {totalExpenseFact.toLocaleString("uk-UA")} ₴
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-subtle mb-0.5">Залишок</div>
                  <div className={cn("text-sm font-semibold tabular-nums", isOver ? "text-danger" : "text-emerald-600")}>
                    {isOver
                      ? `−${(totalExpenseFact - planExpense).toLocaleString("uk-UA")} ₴`
                      : `${remaining2.toLocaleString("uk-UA")} ₴`}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {planExpense > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-subtle">
                    <span>{pctExpense}% від плану</span>
                    <span>план {planExpense.toLocaleString("uk-UA")} ₴</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isOver ? "bg-danger" : pctExpense >= 85 ? "bg-warning" : "bg-emerald-500",
                      )}
                      style={{ width: `${pctExpense}%` }}
                    />
                  </div>
                </>
              )}

              {/* Safe to spend */}
              {safePerDay > 0 && daysLeft2 > 0 && planExpense > 0 && (
                <div className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  isOver ? "bg-danger/10 text-danger"
                    : pctExpense >= 85 ? "bg-warning/10 text-warning"
                    : "bg-emerald-500/10 text-emerald-700",
                )}>
                  <span className="font-semibold">
                    {safePerDay.toLocaleString("uk-UA")} ₴/день
                  </span>
                  <span className="text-[11px] ml-1 opacity-75">
                    · безпечно витрачати ({daysLeft2} дн.)
                  </span>
                </div>
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
          const remaining = Math.max(0, b.limit - bspent);
          const globalIdx = budgets.indexOf(b);
          const forecastForCat = forecasts.find(
            (fc) => fc.categoryId === b.categoryId,
          );
          const showProactiveAdvice =
            pctRaw >= 80 || (forecastForCat && forecastForCat.overLimit);
          const isEditing = editIdx === globalIdx;
          return (
            <LimitBudgetCard
              key={b.id || i}
              budget={b}
              categoryLabel={cat?.label || "—"}
              spent={bspent}
              pctRaw={pctRaw}
              pctRounded={pct}
              remaining={remaining}
              isEditing={isEditing}
              showProactiveAdvice={!!showProactiveAdvice}
              proactiveText={proactiveAdvice[b.categoryId]}
              proactiveLoading={!!proactiveLoading[b.categoryId]}
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
            <div className="text-[11px] font-bold text-subtle uppercase tracking-widest pt-1">
              Прогноз · кінець місяця
            </div>
            {loadingTx && forecasts.length === 0 ? (
              limitBudgets.map((b) => (
                <Skeleton key={b.id} className="h-36 rounded-2xl" />
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
              const explanation = aiExplanations[fc.categoryId];
              const loading = aiLoading[fc.categoryId];
              return (
                <div
                  key={fc.categoryId}
                  className={cn(
                    "bg-panel border rounded-2xl p-5 shadow-card",
                    fc.overLimit ? "border-danger/50" : "border-line/60",
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-semibold">
                      {cat?.label || fc.categoryId}
                    </span>
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "text-xs tabular-nums font-semibold",
                          fc.overLimit ? "text-danger" : "text-muted",
                        )}
                      >
                        {fc.forecast.toLocaleString("uk-UA")} ₴
                      </span>
                      <span className="text-[10px] text-subtle tabular-nums">
                        ліміт {fc.limit.toLocaleString("uk-UA")} ₴
                      </span>
                    </div>
                  </div>

                  {fc.overLimit ? (
                    <div className="text-xs text-danger font-medium mb-2">
                      ⚠️ Перевищення на {fc.overPercent}% (+
                      {(fc.forecast - fc.limit).toLocaleString("uk-UA")} ₴)
                    </div>
                  ) : (
                    <div className="text-xs text-subtle mb-2">
                      Вкладається у ліміт · залишок{" "}
                      {(fc.limit - fc.forecast).toLocaleString("uk-UA")} ₴
                    </div>
                  )}

                  <BudgetTrendChart
                    dailyData={fc.dailyData}
                    limit={fc.limit}
                    color={fc.overLimit ? "#ef4444" : "#6366f1"}
                    className="mb-2"
                  />

                  <div className="flex items-center justify-between text-[10px] text-subtle mt-1 mb-2">
                    <span>Факт: {fc.spent.toLocaleString("uk-UA")} ₴</span>
                    <span>≈{fc.avgPerDay.toLocaleString("uk-UA")} ₴/день</span>
                    <span>Залишилось: {fc.daysRemaining} дн.</span>
                  </div>

                  {explanation && (
                    <div className="text-xs text-text bg-bg rounded-xl px-3 py-2 mb-2 leading-relaxed">
                      {explanation}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      explainCategory(
                        fc.categoryId,
                        cat?.label || fc.categoryId,
                        fc.spent,
                        fc.forecast,
                        fc.limit,
                      )
                    }
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors w-full",
                      loading
                        ? "border-line text-subtle cursor-wait"
                        : "border-primary/40 text-primary hover:bg-primary/10",
                    )}
                  >
                    {loading
                      ? "AI аналізує…"
                      : explanation
                        ? "🔄 Пояснити знову"
                        : "✨ Пояснити"}
                  </button>
                </div>
              );
            })}
          </>
        )}

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
          const monthly = calcMonthlyNeeded(
            b.targetAmount,
            saved,
            b.targetDate,
          );
          const globalIdx = budgets.indexOf(b);
          const isEditing = editIdx === globalIdx;
          return (
            <GoalBudgetCard
              key={b.id || i}
              budget={b}
              saved={saved}
              pct={pct}
              daysLeft={daysLeft}
              monthlyLabel={
                monthly.isAchieved
                  ? "Ціль досягнута 🎉"
                  : monthly.isOverdue
                    ? "Термін минув"
                    : monthly.monthlyNeeded !== null
                      ? `Потрібно відкладати: ${monthly.monthlyNeeded.toLocaleString("uk-UA")} ₴/міс.`
                      : null
              }
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
                <CategorySelector
                  value={newB.categoryId}
                  onChange={(val) => setNewB((b) => ({ ...b, categoryId: val }))}
                  categories={expenseCategoryList.filter((c) => c.id !== "income")}
                  placeholder="Вибери категорію"
                />
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
            {formError && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={addBudget}>
                Додати
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="ghost"
                onClick={resetForm}
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

        {/* Category manager — collapsible at bottom so it never shifts other sections */}
        <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCategories((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-panelHi transition-colors"
          >
            <span>Власні категорії</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("transition-transform text-muted", showCategories ? "rotate-180" : "")}
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showCategories && (
            <div className="px-5 pb-5">
              <CategoryManager
                customCategories={customCategories}
                allCategories={expenseCategoryList}
                onAdd={addCustomCategory}
                onEdit={editCustomCategory}
                onRemove={removeCustomCategory}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
