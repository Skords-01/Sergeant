import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { trackEvent, ANALYTICS_EVENTS } from "../../../core/analytics";
import {
  calcDebtRemaining,
  calcReceivableRemaining,
  calcCategorySpent,
  calcFinykSpendingTotal,
  getMonoTotals,
} from "../utils";
import { getSubscriptionAmountMeta } from "../domain/subscriptionUtils.js";
import { getMonthlySummary } from "../domain/selectors";
import {
  getLimitBudgets,
  isBudgetAlert,
  getCurrentMonthContext,
} from "../domain/budget";
import { getCategorySpendList } from "../domain/categories";
import { filterStatTransactions } from "../domain/transactions";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { THEME_HEX } from "@shared/lib/themeHex.js";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { RetroComparison } from "../components/RetroComparison";

import { FirstInsightBanner } from "./overview/FirstInsightBanner.jsx";
import { HeroCard } from "./overview/HeroCard.jsx";
import { IncomeExpensePills } from "./overview/IncomeExpensePills.jsx";
import { NavButtons } from "./overview/NavButtons.jsx";
import { MonthPulseCard } from "./overview/MonthPulseCard.jsx";
import { NetworthSection } from "./overview/NetworthSection.jsx";
import { BudgetAlertsList } from "./overview/BudgetAlertsList.jsx";
import { PlanFactCard } from "./overview/PlanFactCard.jsx";
import { QuickAddCard } from "./overview/QuickAddCard.jsx";
import { PlannedFlowsCard } from "./overview/PlannedFlowsCard.jsx";
import { CategoryChartSection } from "./overview/CategoryChartSection.jsx";

const parseLocalDate = (isoDate) => {
  const [y, m, d] = (isoDate || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const formatDaysLeft = (days) => {
  if (days === 0) return "сьогодні";
  if (days === 1) return "завтра";
  if (days <= 3) return `через ${days} дн`;
  return `через ${days} дн`;
};
const getNextBillingDate = (billingDay, now) => {
  const y = now.getFullYear(),
    m = now.getMonth();
  let d = new Date(y, m, Math.min(billingDay, new Date(y, m + 1, 0).getDate()));
  if (d < new Date(y, m, now.getDate()))
    d = new Date(
      y,
      m + 1,
      Math.min(billingDay, new Date(y, m + 2, 0).getDate()),
    );
  return d;
};

export function Overview({
  mono,
  storage,
  onNavigate,
  onCategoryClick,
  showBalance = true,
  frequentCategories = [],
  frequentMerchants = [],
  onQuickAdd,
}) {
  const {
    realTx,
    loadingTx,
    clientInfo,
    accounts,
    transactions,
    syncState,
    lastUpdated,
    error: monoError,
    refresh: monoRefresh,
    privatTotal = 0,
  } = mono;
  const {
    budgets,
    subscriptions,
    manualDebts,
    receivables,
    hiddenAccounts,
    excludedTxIds,
    monthlyPlan,
    networthHistory,
    saveNetworthSnapshot,
    txCategories,
    txSplits,
    manualAssets,
    customCategories,
    manualExpenses = [],
  } = storage;

  const now = new Date();
  const { daysInMonth, daysPassed } = getCurrentMonthContext(now);

  const statTx = useMemo(
    () => filterStatTransactions(realTx, excludedTxIds),
    [realTx, excludedTxIds],
  );
  const spent = useMemo(
    () => calcFinykSpendingTotal(statTx, { txSplits }),
    [statTx, txSplits],
  );
  // Pure selector keeps summary math out of the component; rounded totals
  // match the spend/income totals shown on the Analytics page.
  const monthlySummary = useMemo(
    () => getMonthlySummary(realTx, { excludedTxIds, txSplits }),
    [realTx, excludedTxIds, txSplits],
  );
  const income = monthlySummary.income;
  const projectedSpend =
    daysPassed > 0 ? (spent / daysPassed) * daysInMonth : 0;

  const { balance: monoOnlyTotal, debt: monoTotalDebt } = useMemo(
    () => getMonoTotals(accounts, hiddenAccounts),
    [accounts, hiddenAccounts],
  );
  const monoTotal = monoOnlyTotal + privatTotal;
  const manualDebtTotal = useMemo(
    () =>
      manualDebts.reduce((s, d) => s + calcDebtRemaining(d, transactions), 0),
    [manualDebts, transactions],
  );
  const totalDebt = monoTotalDebt + manualDebtTotal;
  const totalReceivable = useMemo(
    () =>
      receivables.reduce(
        (s, r) => s + calcReceivableRemaining(r, transactions),
        0,
      ),
    [receivables, transactions],
  );
  const manualAssetTotal = useMemo(
    () =>
      (manualAssets || [])
        .filter((a) => a.currency === "UAH")
        .reduce((s, a) => s + Number(a.amount), 0),
    [manualAssets],
  );
  const networth = monoTotal + manualAssetTotal + totalReceivable - totalDebt;

  // useMemo — стабільне посилання на масив лімітів, щоб нижче
  // budgetAlerts/inline-рендер списку не перезапускались, поки
  // сам `budgets` не змінився.
  const limitBudgets = useMemo(() => getLimitBudgets(budgets), [budgets]);
  const catSpends = useMemo(
    () =>
      getCategorySpendList(statTx, {
        txCategories,
        txSplits,
        customCategories,
      }),
    [statTx, txCategories, txSplits, customCategories],
  );

  useEffect(() => {
    if (loadingTx && realTx.length === 0) return;
    if (networth !== 0 && accounts.length > 0) {
      saveNetworthSnapshot(networth);
    }
  }, [
    networth,
    loadingTx,
    realTx.length,
    accounts.length,
    saveNetworthSnapshot,
  ]);

  // First-insight banner — shown exactly once, the moment the user first
  // sees the Overview with any real data (manual expense or bank tx).
  // Dismissing it (✕ or CTA) sets the flag so we never show it again.
  const hasAnyData = manualExpenses.length > 0 || realTx.length > 0;
  const [showFirstInsight, setShowFirstInsight] = useState(() => {
    try {
      return !localStorage.getItem("finyk_first_insight_seen_v1");
    } catch {
      return false;
    }
  });
  // Ref guard — `manualExpenses.length` is in the dep array (to satisfy
  // exhaustive-deps and to initially trigger once data lands), but we only
  // ever want to fire the event on the *first* time the banner becomes
  // eligible in a given session. Adding a new expense later must not
  // re-fire the activation metric.
  const insightFiredRef = useRef(false);
  useEffect(() => {
    if (insightFiredRef.current) return;
    if (!showFirstInsight || !hasAnyData) return;
    insightFiredRef.current = true;
    try {
      localStorage.setItem("finyk_first_insight_seen_v1", "1");
    } catch {
      /* noop */
    }
    trackEvent(ANALYTICS_EVENTS.FIRST_INSIGHT_SEEN, {
      source: manualExpenses.length > 0 ? "manual" : "bank",
    });
  }, [showFirstInsight, hasAnyData, manualExpenses.length]);
  const dismissFirstInsight = useCallback(() => setShowFirstInsight(false), []);
  const handleSetBudgetFromInsight = useCallback(() => {
    dismissFirstInsight();
    onNavigate?.("budgets");
  }, [dismissFirstInsight, onNavigate]);

  const budgetAlerts = useMemo(
    () =>
      limitBudgets.filter((b) =>
        isBudgetAlert(
          calcCategorySpent(
            statTx,
            b.categoryId,
            txCategories,
            txSplits,
            customCategories,
          ),
          b.limit,
        ),
      ),
    [limitBudgets, statTx, txCategories, txSplits, customCategories],
  );

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // useMemo — обчислення flow-масивів проходить по всіх підписках/боргах
  // і не повинно повторюватись при незв'язаних змінах (наприклад,
  // перемикання вкладок, лоадер транзакцій). Залежності підібрані точно,
  // щоб масив перераховувався лише при реальній зміні даних.
  const subscriptionFlows = useMemo(
    () =>
      subscriptions.map((sub) => {
        const { amount, currency } = getSubscriptionAmountMeta(
          sub,
          transactions,
        );
        const dueDate = getNextBillingDate(sub.billingDay, now);
        const daysLeft = Math.ceil(
          (dueDate.getTime() - todayStart.getTime()) / 86400000,
        );
        return {
          id: `sub-${sub.id}`,
          title: `${sub.emoji} ${sub.name}`,
          amount,
          sign: "-",
          color: THEME_HEX.danger,
          daysLeft,
          hint: formatDaysLeft(daysLeft),
          currency,
          dueDate,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscriptions, transactions, todayStart.getTime()],
  );

  const debtOutFlows = useMemo(
    () =>
      manualDebts
        .map((d) => ({ ...d, remaining: calcDebtRemaining(d, transactions) }))
        .filter((d) => d.dueDate && d.remaining > 0)
        .map((d) => {
          const daysLeft = Math.ceil(
            (parseLocalDate(d.dueDate).getTime() - todayStart.getTime()) /
              86400000,
          );
          return {
            id: `debt-${d.id}`,
            title: `${d.emoji || "💸"} ${d.name}`,
            amount: d.remaining,
            sign: "-",
            color: THEME_HEX.danger,
            daysLeft,
            hint: formatDaysLeft(daysLeft),
            currency: "₴",
            dueDate: parseLocalDate(d.dueDate),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manualDebts, transactions, todayStart.getTime()],
  );

  const debtInFlows = useMemo(
    () =>
      receivables
        .map((r) => ({
          ...r,
          remaining: calcReceivableRemaining(r, transactions),
        }))
        .filter((r) => r.dueDate && r.remaining > 0)
        .map((r) => {
          const daysLeft = Math.ceil(
            (parseLocalDate(r.dueDate).getTime() - todayStart.getTime()) /
              86400000,
          );
          return {
            id: `recv-${r.id}`,
            title: `${r.emoji || "💰"} ${r.name}`,
            amount: r.remaining,
            sign: "+",
            color: THEME_HEX.success,
            daysLeft,
            hint: formatDaysLeft(daysLeft),
            currency: "₴",
            dueDate: parseLocalDate(r.dueDate),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receivables, transactions, todayStart.getTime()],
  );

  // useMemo — злиття+сортування трьох масивів; перерахунок лише коли
  // хоч один з flow-масивів справді змінився.
  const plannedFlows = useMemo(
    () =>
      [...subscriptionFlows, ...debtOutFlows, ...debtInFlows]
        .filter((x) => x.daysLeft >= 0 && x.daysLeft <= 10)
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [subscriptionFlows, debtOutFlows, debtInFlows],
  );

  const planIncome = Number(monthlyPlan?.income || 0);
  const planExpense = Number(monthlyPlan?.expense || 0);
  const planSavings = Number(monthlyPlan?.savings || 0);
  const factSavings = income - spent;
  const remainingDays = Math.max(1, daysInMonth - daysPassed + 1);
  const expenseTarget = planExpense > 0 ? planExpense : projectedSpend;
  // useMemo — `monthFlows` проходить по всіх flow-массивах і створює нову
  // Date для фільтра; кешуємо, доки flow-массиви та поточний місяць не
  // змінились.
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthFlows = useMemo(
    () =>
      [...subscriptionFlows, ...debtOutFlows, ...debtInFlows].filter(
        (f) =>
          f.daysLeft >= 0 &&
          f.dueDate &&
          f.dueDate <= new Date(currentYear, currentMonth + 1, 0),
      ),
    [subscriptionFlows, debtOutFlows, debtInFlows, currentYear, currentMonth],
  );

  if (loadingTx && realTx.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 page-tabbar-pad space-y-4 max-w-4xl mx-auto">
          <Skeleton className="h-[168px] rounded-3xl" />
          <Skeleton className="h-[120px] opacity-80 rounded-2xl" />
          <Skeleton className="h-[110px] opacity-60 rounded-2xl" />
          <Skeleton className="h-[90px] opacity-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  const recurringOutThisMonth = monthFlows
    .filter((f) => f.sign === "-" && typeof f.amount === "number")
    .reduce((sum, f) => sum + f.amount, 0);
  const recurringInThisMonth = monthFlows
    .filter((f) => f.sign === "+" && typeof f.amount === "number")
    .reduce((sum, f) => sum + f.amount, 0);
  const unknownOutCount = monthFlows.filter(
    (f) => f.sign === "-" && f.amount === null,
  ).length;
  const expenseLeft =
    expenseTarget - spent - recurringOutThisMonth + recurringInThisMonth;
  const dayBudget = expenseLeft / remainingDays;

  const monthBalance = income - spent;
  const spendPct = Math.min(100, income > 0 ? (spent / income) * 100 : 0);
  const expenseFromIncomeBarClass =
    spendPct > 75 ? "bg-danger" : spendPct > 50 ? "bg-warning" : "bg-success";
  const showMonthForecast = showBalance && daysPassed > 0 && projectedSpend > 0;
  const forecastTrendPct = showMonthForecast
    ? Math.min(100, Math.round((spent / projectedSpend) * 100))
    : 0;
  const forecastBarClass =
    forecastTrendPct > 75
      ? "bg-danger"
      : forecastTrendPct > 50
        ? "bg-warning"
        : "bg-emerald-500";

  const spendPlanRatio = expenseTarget > 0 ? spent / expenseTarget : 0;
  const hasExpensePlan = expenseTarget > 0;

  const firstName =
    clientInfo?.name?.split(" ")[1] ||
    clientInfo?.name?.split(" ")[0] ||
    "друже";
  const dateLabel = now.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pt-4 page-tabbar-pad space-y-4 max-w-4xl mx-auto">
        {(clientInfo ||
          syncState?.status === "error" ||
          syncState?.status === "loading" ||
          monoError) && (
          <SyncStatusBadge
            syncState={syncState}
            lastUpdated={lastUpdated}
            error={monoError}
            onRetry={monoRefresh}
            loading={loadingTx}
          />
        )}

        {showFirstInsight && hasAnyData && (
          <FirstInsightBanner
            onSetBudget={handleSetBudgetFromInsight}
            onDismiss={dismissFirstInsight}
          />
        )}

        <HeroCard
          networth={networth}
          monoTotal={monoTotal}
          totalDebt={totalDebt}
          monthBalance={monthBalance}
          firstName={firstName}
          dateLabel={dateLabel}
          showBalance={showBalance}
        />

        <p className="text-xs text-subtle px-1 -mt-1 leading-relaxed">
          Огляд, категорії та бюджети на цій сторінці — у гривні (UAH). Інші
          валюти рахунків у загальному балансі не конвертуються автоматично.
        </p>

        <IncomeExpensePills
          income={income}
          spent={spent}
          showBalance={showBalance}
        />

        <RetroComparison
          transactions={realTx}
          excludedTxIds={excludedTxIds}
          txSplits={txSplits}
          now={now}
          showBalance={showBalance}
        />

        <NavButtons onNavigate={onNavigate} />

        <MonthPulseCard
          dateLabel={dateLabel}
          daysInMonth={daysInMonth}
          daysPassed={daysPassed}
          spent={spent}
          income={income}
          showBalance={showBalance}
          showMonthForecast={showMonthForecast}
          projectedSpend={projectedSpend}
          spendPct={spendPct}
          expenseFromIncomeBarClass={expenseFromIncomeBarClass}
          forecastTrendPct={forecastTrendPct}
          forecastBarClass={forecastBarClass}
          dayBudget={dayBudget}
          monthBalance={monthBalance}
          spendPlanRatio={spendPlanRatio}
          hasExpensePlan={hasExpensePlan}
          recurringOutThisMonth={recurringOutThisMonth}
          recurringInThisMonth={recurringInThisMonth}
          unknownOutCount={unknownOutCount}
        />

        <NetworthSection networthHistory={networthHistory} />

        <BudgetAlertsList
          budgetAlerts={budgetAlerts}
          statTx={statTx}
          txCategories={txCategories}
          txSplits={txSplits}
          customCategories={customCategories}
        />

        <PlanFactCard
          planIncome={planIncome}
          planExpense={planExpense}
          planSavings={planSavings}
          income={income}
          spent={spent}
          factSavings={factSavings}
        />

        <QuickAddCard
          onQuickAdd={onQuickAdd}
          frequentCategories={frequentCategories}
          frequentMerchants={frequentMerchants}
        />

        <PlannedFlowsCard
          plannedFlows={plannedFlows}
          onNavigate={onNavigate}
          showBalance={showBalance}
        />

        <CategoryChartSection
          catSpends={catSpends}
          onNavigate={onNavigate}
          onCategoryClick={onCategoryClick}
        />

        {realTx.length > 0 && (
          <button
            onClick={() => onNavigate("transactions")}
            className="w-full py-4 text-sm font-medium text-subtle/70 border border-line/40 border-dashed rounded-2xl hover:border-muted/50 hover:text-muted transition-colors min-h-[52px]"
          >
            Усі операції ({realTx.length}) →
          </button>
        )}
        {loadingTx && (
          <p className="text-center text-xs text-subtle py-4">Оновлення…</p>
        )}
      </div>
    </div>
  );
}
