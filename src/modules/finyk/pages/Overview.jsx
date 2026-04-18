import { memo, useMemo, useEffect, Suspense } from "react";
import { CategoryChart, NetworthChart } from "../components/charts/lazy";
import { ChartFallback } from "../components/charts/ChartFallback";
import {
  calcDebtRemaining,
  calcReceivableRemaining,
  calcCategorySpent,
  calcFinykSpendingTotal,
  getMonoTotals,
  resolveExpenseCategoryMeta,
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
import { cn } from "@shared/lib/cn";
import { THEME_HEX } from "@shared/lib/themeHex.js";
import { SyncStatusBadge } from "../components/SyncStatusBadge";

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

// Рядок запланованого грошового потоку. Пропси вже готові до рендеру —
// memo знімає перерахунок і diff на кожному ре-рендері Overview.
const FlowRow = memo(function FlowRow({ flow, showAmount = true }) {
  const isGreen = flow.color === THEME_HEX.success;
  return (
    <div className="flex justify-between items-center py-3 border-b border-line last:border-0">
      <div className="min-w-0 mr-3">
        <div className="text-[15px] font-medium leading-snug truncate">
          {flow.title}
        </div>
        <div className="text-xs text-subtle mt-0.5">{flow.hint}</div>
      </div>
      <div
        className={cn(
          "text-[15px] font-bold tabular-nums shrink-0",
          isGreen ? "text-success" : "text-danger",
        )}
      >
        {showAmount
          ? (flow.amount === null
              ? `${flow.sign}?`
              : `${flow.sign}${flow.amount.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`) +
            ` ${flow.currency}`
          : "••••"}
      </div>
    </div>
  );
});

export function Overview({
  mono,
  storage,
  onNavigate,
  onCategoryClick,
  showBalance = true,
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
        const daysLeft = Math.ceil((dueDate - todayStart) / 86400000);
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
            (parseLocalDate(d.dueDate) - todayStart) / 86400000,
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
            (parseLocalDate(r.dueDate) - todayStart) / 86400000,
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

  let pulseAccentLeft;
  let pulseBg;
  let pulseColor;
  let pulseStatusText;

  if (hasExpensePlan) {
    if (spendPlanRatio > 0.75) {
      pulseAccentLeft = "border-l-red-500";
      pulseBg = "bg-pulse-b";
      pulseColor = "text-danger";
      pulseStatusText = "Понад 75% запланованого";
    } else if (spendPlanRatio > 0.5) {
      pulseAccentLeft = "border-l-amber-500";
      pulseBg = "bg-pulse-w";
      pulseColor = "text-warning";
      pulseStatusText = "Понад 50% запланованого";
    } else {
      pulseAccentLeft = "border-l-emerald-500";
      pulseBg = "bg-pulse-ok";
      pulseColor = "text-success";
      pulseStatusText = "В межах плану";
    }
  } else {
    const pulseGood = dayBudget >= 200;
    const pulseWarn = dayBudget >= 0 && dayBudget < 200;
    const pulseBad = dayBudget < 0;
    pulseAccentLeft = pulseGood
      ? "border-l-emerald-500"
      : pulseWarn
        ? "border-l-amber-500"
        : "border-l-red-500";
    pulseBg = pulseGood
      ? "bg-pulse-ok"
      : pulseWarn
        ? "bg-pulse-w"
        : "bg-pulse-b";
    pulseColor = pulseGood
      ? "text-success"
      : pulseWarn
        ? "text-warning"
        : "text-danger";
    pulseStatusText = pulseBad
      ? "Перевитрата"
      : pulseWarn
        ? "Обережно — майже вичерпано"
        : "В нормі";
  }

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

        {/* ── Hero (як у прототипі: градієнт + зведення) ── */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-5 shadow-float border border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-emerald-100/90 text-sm">Загальний нетворс</p>
              <p className="text-[11px] text-emerald-200/70 mt-0.5">
                {firstName} · {dateLabel}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "text-[40px] font-bold tracking-tight leading-tight mt-2 tabular-nums",
              !showBalance && "tracking-widest",
            )}
          >
            {showBalance ? (
              <>
                {networth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                <span className="text-2xl font-semibold text-emerald-100 ml-1">
                  ₴
                </span>
              </>
            ) : (
              "••••••"
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 text-emerald-100">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-90"
              aria-hidden
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span className="text-sm">
              {showBalance
                ? `Баланс місяця: ${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                : "••••"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-white/20 text-sm">
            <div>
              <div className="text-[11px] text-emerald-200/80 mb-0.5">
                На картках
              </div>
              <div className="font-semibold tabular-nums text-emerald-50">
                {showBalance
                  ? `+${monoTotal.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                  : "••••"}
              </div>
            </div>
            <div className="w-px bg-white/25 hidden sm:block self-stretch min-h-[2.5rem]" />
            <div>
              <div className="text-[11px] text-emerald-200/80 mb-0.5">
                Борги
              </div>
              <div className="font-semibold tabular-nums text-emerald-50">
                {showBalance
                  ? `−${totalDebt.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                  : "••••"}
              </div>
            </div>
            <div className="w-px bg-white/25 hidden sm:block self-stretch min-h-[2.5rem]" />
            <div>
              <div className="text-[11px] text-emerald-200/80 mb-0.5">
                Місяць
              </div>
              <div
                className={cn(
                  "font-semibold tabular-nums",
                  monthBalance >= 0 ? "text-emerald-50" : "text-amber-200",
                )}
              >
                {showBalance
                  ? `${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                  : "••••"}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-subtle px-1 -mt-1 leading-relaxed">
          Огляд, категорії та бюджети на цій сторінці — у гривні (UAH). Інші
          валюти рахунків у загальному балансі не конвертуються автоматично.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 text-emerald-600">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span className="text-xs text-subtle">Дохід</span>
            </div>
            <p className="text-xl font-semibold mt-1 tabular-nums text-text">
              {showBalance
                ? `+${income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`
                : "••••"}{" "}
              <span className="text-base font-medium text-muted">₴</span>
            </p>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 text-red-500">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
              <span className="text-xs text-subtle">Витрати</span>
            </div>
            <p className="text-xl font-semibold mt-1 tabular-nums text-text">
              {showBalance
                ? `−${spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`
                : "••••"}{" "}
              <span className="text-base font-medium text-muted">₴</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate("transactions")}
            className="flex-1 min-w-[140px] min-h-[44px] rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text shadow-card hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-colors"
          >
            Операції →
          </button>
          <button
            type="button"
            onClick={() => onNavigate("budgets")}
            className="flex-1 min-w-[140px] min-h-[44px] rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text shadow-card hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-colors"
          >
            Бюджети →
          </button>
        </div>

        {/* ── Місяць: дохід і витрати, прогноз, фінпульс (одна картка) ── */}
        <div
          className={cn(
            "rounded-2xl border border-line/60 bg-panel p-5 shadow-card border-l-[4px]",
            pulseAccentLeft,
            pulseBg,
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xs font-medium text-subtle">Місяць</div>
              <p className="text-[11px] text-subtle/80 mt-0.5 capitalize">
                {dateLabel}
              </p>
            </div>
            <span className="text-[11px] text-subtle/60 shrink-0 text-right tabular-nums">
              {Math.max(0, daysInMonth - daysPassed)} дн. залишилось
            </span>
          </div>

          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="text-xs text-subtle font-medium">Витрати</div>
              <div className="text-[26px] font-bold tabular-nums mt-1 leading-tight">
                {showBalance
                  ? spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })
                  : "••••"}
                {showBalance && (
                  <span className="text-base font-medium text-muted ml-1">
                    ₴
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-subtle font-medium">Дохід</div>
              <div className="text-[26px] font-bold tabular-nums mt-1 leading-tight text-success">
                {showBalance ? (
                  <>
                    +
                    {income.toLocaleString("uk-UA", {
                      maximumFractionDigits: 0,
                    })}
                    <span className="text-base font-medium text-success/70 ml-1">
                      ₴
                    </span>
                  </>
                ) : (
                  "••••"
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] text-subtle/70">
              <span>Витрати від доходу</span>
              <span>{showBalance ? `${Math.round(spendPct)}%` : "—"}</span>
            </div>
            <div className="h-1.5 bg-bg rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  expenseFromIncomeBarClass,
                )}
                style={{ width: showBalance ? `${spendPct}%` : "0%" }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-subtle/70">
              <span>
                {showBalance
                  ? `Залишок: ${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                  : "—"}
              </span>
              <span>
                {showBalance && !showMonthForecast && projectedSpend > 0
                  ? `Прогноз витрат ${projectedSpend.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                  : showBalance && showMonthForecast
                    ? null
                    : "—"}
              </span>
            </div>
          </div>

          {showMonthForecast && (
            <div className="mt-4 pt-4 border-t border-line/50 space-y-2">
              <div className="text-xs font-medium text-subtle">
                Факт і прогноз витрат
              </div>
              <p className="text-[11px] text-subtle/80 leading-snug">
                За {daysPassed}{" "}
                {daysPassed === 1 ? "день" : daysPassed < 5 ? "дні" : "дн."} ·
                факт{" "}
                <span className="font-semibold text-text tabular-nums">
                  {spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}{" "}
                  ₴
                </span>
                {" · "}до кінця місяця ~{" "}
                <span className="font-semibold text-text tabular-nums">
                  {Math.round(projectedSpend).toLocaleString("uk-UA", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  ₴
                </span>
              </p>
              <div className="h-2.5 bg-bg rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    forecastBarClass,
                  )}
                  style={{ width: `${forecastTrendPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-subtle/70">
                <span>{forecastTrendPct}% від прогнозу за темпом</span>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-line/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-subtle">Фінпульс</span>
              <span className="text-[11px] text-subtle/60">
                цільова витрата на день
              </span>
            </div>
            <div
              className={cn(
                "text-[30px] sm:text-[34px] font-bold leading-tight tabular-nums mt-2",
                pulseColor,
                !showBalance && "tracking-widest",
              )}
            >
              {showBalance ? (
                <>
                  {Math.abs(dayBudget).toLocaleString("uk-UA", {
                    maximumFractionDigits: 0,
                  })}
                  <span className="text-base font-medium text-subtle ml-1">
                    ₴/день
                  </span>
                </>
              ) : (
                "••••"
              )}
            </div>
            <div className={cn("text-sm mt-0.5", pulseColor)}>
              {pulseStatusText}
            </div>
            {(recurringOutThisMonth > 0 || recurringInThisMonth > 0) &&
              showBalance && (
                <div className="text-[11px] text-subtle/70 mt-2 leading-relaxed">
                  Враховано планових: −
                  {recurringOutThisMonth.toLocaleString("uk-UA", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  / +
                  {recurringInThisMonth.toLocaleString("uk-UA", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  ₴{unknownOutCount > 0 && ` + ${unknownOutCount} без суми`}
                </div>
              )}
          </div>
        </div>

        {/* ── Networth chart ── */}
        {networthHistory.length >= 2 ? (
          <div className="bg-panel border border-line/60 rounded-2xl px-5 pt-4 pb-3 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-subtle">
                Динаміка нетворсу
              </span>
              <span className="text-xs text-subtle/60">
                {networthHistory.length} міс.
              </span>
            </div>
            <Suspense fallback={<ChartFallback className="h-20" />}>
              <NetworthChart data={networthHistory} />
            </Suspense>
          </div>
        ) : (
          <div className="bg-panel border border-dashed border-line/60 rounded-2xl p-6 text-center shadow-card">
            <p className="text-sm text-subtle">
              Ще мало знімків для графіка нетворсу — з’явиться після кількох
              змін балансу.
            </p>
          </div>
        )}

        {/* ── Budget alerts ── */}
        {budgetAlerts.length > 0 && (
          <div className="space-y-1.5">
            {budgetAlerts.map((b, i) => {
              const cat = resolveExpenseCategoryMeta(
                b.categoryId,
                customCategories,
              );
              const s = calcCategorySpent(
                statTx,
                b.categoryId,
                txCategories,
                txSplits,
                customCategories,
              );
              const pct = Math.round((s / b.limit) * 100);
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-2xl px-4 py-3 flex items-center justify-between border",
                    pct >= 100
                      ? "bg-danger/8 border-danger/20"
                      : "bg-warning/8 border-warning/20",
                  )}
                >
                  <span className="text-sm font-medium">
                    {cat?.label || b.categoryId}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      pct >= 100 ? "text-danger" : "text-warning",
                    )}
                  >
                    {pct}% {pct >= 100 ? "⚠ перевищено" : "· понад 60% ліміту"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Plan/Fact ── */}
        {(planIncome > 0 || planExpense > 0 || planSavings > 0) && (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
            <div className="text-xs font-medium text-subtle mb-3">
              План / Факт
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="text-[11px] text-subtle/60 mb-1">План</div>
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
                <div className="text-[11px] text-subtle/60 mb-1">Факт</div>
                <div className="text-sm text-success tabular-nums">
                  +
                  {income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}{" "}
                  ₴
                </div>
                <div className="text-sm text-danger tabular-nums">
                  −{spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}{" "}
                  ₴
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
          </div>
        )}

        {/* ── Planned flows ── */}
        {plannedFlows.length > 0 && (
          <div className="bg-panel border border-line/60 rounded-2xl overflow-hidden shadow-card">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-subtle">
                Найближчі платежі
              </span>
              <button
                onClick={() => onNavigate("budgets")}
                className="text-xs text-primary/80 hover:text-primary transition-colors py-2 px-1 min-h-[36px]"
              >
                Усі →
              </button>
            </div>
            <div className="px-5 pb-3">
              {plannedFlows.slice(0, 5).map((f) => (
                <FlowRow key={f.id} flow={f} showAmount={showBalance} />
              ))}
            </div>
          </div>
        )}

        {/* ── Category chart ── */}
        {catSpends.length > 0 ? (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
            <div className="text-xs font-medium text-subtle mb-4">
              Витрати за категоріями
            </div>
            <Suspense fallback={<ChartFallback className="h-40" />}>
              <CategoryChart
                data={catSpends.slice(0, 6)}
                onBarClick={
                  onCategoryClick
                    ? (catId) => {
                        onCategoryClick(catId);
                        onNavigate?.("transactions");
                      }
                    : undefined
                }
              />
            </Suspense>
          </div>
        ) : (
          <div className="bg-panel border border-dashed border-line/60 rounded-2xl p-8 text-center shadow-card">
            <p className="text-sm text-subtle">
              Поки немає витрат за категоріями цього місяця.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("transactions")}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              Переглянути операції
            </button>
          </div>
        )}

        {/* ── Tx link ── */}
        {realTx.length > 0 && (
          <button
            onClick={() => onNavigate("transactions")}
            className="w-full py-4 text-sm font-medium text-subtle/70 border border-line/40 border-dashed rounded-2xl hover:border-muted/50 hover:text-muted transition-colors min-h-[52px]"
          >
            Усі операції ({realTx.length}) →
          </button>
        )}
        {loadingTx && (
          <p className="text-center text-xs text-subtle py-4">Оновлення...</p>
        )}
      </div>
    </div>
  );
}
