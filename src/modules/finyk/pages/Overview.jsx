import { useMemo, useEffect } from "react";
import { CategoryChart } from "../components/CategoryChart";
import { NetworthChart } from "../components/NetworthChart";
import { MCC_CATEGORIES } from "../constants";
import { calcDebtRemaining, calcReceivableRemaining, calcCategorySpent, getMonoTotals, getTxStatAmount } from "../utils";
import { getSubscriptionAmountMeta } from "../domain/subscriptionUtils.js";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { cn } from "@shared/lib/cn";

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
  const y = now.getFullYear(), m = now.getMonth();
  let d = new Date(y, m, Math.min(billingDay, new Date(y, m + 1, 0).getDate()));
  if (d < new Date(y, m, now.getDate())) d = new Date(y, m + 1, Math.min(billingDay, new Date(y, m + 2, 0).getDate()));
  return d;
};

function FlowRow({ flow, showAmount = true }) {
  const isGreen = flow.color === "#22c55e";
  return (
    <div className="flex justify-between items-center py-3 border-b border-line last:border-0">
      <div className="min-w-0 mr-3">
        <div className="text-[15px] font-medium leading-snug truncate">{flow.title}</div>
        <div className="text-xs text-subtle mt-0.5">{flow.hint}</div>
      </div>
      <div className={cn("text-[15px] font-bold tabular-nums shrink-0", isGreen ? "text-success" : "text-danger")}>
        {showAmount
          ? (flow.amount === null ? `${flow.sign}?` : `${flow.sign}${flow.amount.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`) + ` ${flow.currency}`
          : "••••"}
      </div>
    </div>
  );
}

export function Overview({ mono, storage, onNavigate, onCategoryClick, showBalance = true }) {
  const { realTx, loadingTx, clientInfo, accounts, transactions } = mono;
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
  } = storage;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();

  const statTx = useMemo(() => realTx.filter(t => !excludedTxIds.has(t.id)), [realTx, excludedTxIds]);
  const spent = useMemo(() => statTx.filter(t => t.amount < 0).reduce((s, t) => s + getTxStatAmount(t, txSplits), 0), [statTx, txSplits]);
  const income = useMemo(() => statTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount / 100, 0), [statTx]);
  const projectedSpend = daysPassed > 0 ? (spent / daysPassed) * daysInMonth : 0;

  const { balance: monoTotal, debt: monoTotalDebt } = useMemo(() => getMonoTotals(accounts, hiddenAccounts), [accounts, hiddenAccounts]);
  const manualDebtTotal = useMemo(() => manualDebts.reduce((s, d) => s + calcDebtRemaining(d, transactions), 0), [manualDebts, transactions]);
  const totalDebt = monoTotalDebt + manualDebtTotal;
  const totalReceivable = useMemo(() => receivables.reduce((s, r) => s + calcReceivableRemaining(r, transactions), 0), [receivables, transactions]);
  const manualAssetTotal = useMemo(
    () => (manualAssets || []).filter(a => a.currency === "UAH").reduce((s, a) => s + Number(a.amount), 0),
    [manualAssets],
  );
  const networth = monoTotal + manualAssetTotal + totalReceivable - totalDebt;

  const limitBudgets = budgets.filter(b => b.type === "limit");
  const goalBudgets = budgets.filter(b => b.type === "goal");
  const catSpends = useMemo(() => MCC_CATEGORIES.filter(c => c.id !== "income").map(cat => ({
    ...cat, spent: calcCategorySpent(statTx, cat.id, txCategories, txSplits),
  })).filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent), [statTx, txCategories, txSplits]);

  useEffect(() => {
    if (loadingTx && realTx.length === 0) return;
    if (networth !== 0 && accounts.length > 0) {
      saveNetworthSnapshot(networth);
    }
  }, [networth, loadingTx, realTx.length, accounts.length, saveNetworthSnapshot]);

  const budgetAlerts = useMemo(() => limitBudgets.filter(b => {
    const s = calcCategorySpent(statTx, b.categoryId, txCategories, txSplits);
    return b.limit > 0 && s / b.limit >= 0.8;
  }), [limitBudgets, statTx, txCategories, txSplits]);

  if (loadingTx && realTx.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-4 max-w-4xl mx-auto">
          <Skeleton className="h-[168px] rounded-3xl" />
          <Skeleton className="h-[120px] opacity-80 rounded-2xl" />
          <Skeleton className="h-[110px] opacity-60 rounded-2xl" />
          <Skeleton className="h-[90px] opacity-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const subscriptionFlows = subscriptions.map(sub => {
    const { amount, currency } = getSubscriptionAmountMeta(sub, transactions);
    const dueDate = getNextBillingDate(sub.billingDay, now);
    const daysLeft = Math.ceil((dueDate - todayStart) / 86400000);
    return { id: `sub-${sub.id}`, title: `${sub.emoji} ${sub.name}`, amount, sign: "-", color: "#f87171", daysLeft, hint: formatDaysLeft(daysLeft), currency, dueDate };
  });

  const debtOutFlows = manualDebts
    .map(d => ({ ...d, remaining: calcDebtRemaining(d, transactions) }))
    .filter(d => d.dueDate && d.remaining > 0)
    .map(d => {
      const daysLeft = Math.ceil((parseLocalDate(d.dueDate) - todayStart) / 86400000);
      return { id: `debt-${d.id}`, title: `${d.emoji || "💸"} ${d.name}`, amount: d.remaining, sign: "-", color: "#f87171", daysLeft, hint: formatDaysLeft(daysLeft), currency: "₴", dueDate: parseLocalDate(d.dueDate) };
    });

  const debtInFlows = receivables
    .map(r => ({ ...r, remaining: calcReceivableRemaining(r, transactions) }))
    .filter(r => r.dueDate && r.remaining > 0)
    .map(r => {
      const daysLeft = Math.ceil((parseLocalDate(r.dueDate) - todayStart) / 86400000);
      return { id: `recv-${r.id}`, title: `${r.emoji || "💰"} ${r.name}`, amount: r.remaining, sign: "+", color: "#22c55e", daysLeft, hint: formatDaysLeft(daysLeft), currency: "₴", dueDate: parseLocalDate(r.dueDate) };
    });

  const plannedFlows = [...subscriptionFlows, ...debtOutFlows, ...debtInFlows]
    .filter(x => x.daysLeft >= 0 && x.daysLeft <= 10).sort((a, b) => a.daysLeft - b.daysLeft);

  const planIncome = Number(monthlyPlan?.income || 0);
  const planExpense = Number(monthlyPlan?.expense || 0);
  const planSavings = Number(monthlyPlan?.savings || 0);
  const factSavings = income - spent;
  const remainingDays = Math.max(1, daysInMonth - daysPassed + 1);
  const expenseTarget = planExpense > 0 ? planExpense : projectedSpend;
  const monthFlows = [...subscriptionFlows, ...debtOutFlows, ...debtInFlows]
    .filter(f => f.daysLeft >= 0 && f.dueDate && f.dueDate <= new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const recurringOutThisMonth = monthFlows.filter(f => f.sign === "-" && typeof f.amount === "number").reduce((sum, f) => sum + f.amount, 0);
  const recurringInThisMonth = monthFlows.filter(f => f.sign === "+" && typeof f.amount === "number").reduce((sum, f) => sum + f.amount, 0);
  const unknownOutCount = monthFlows.filter(f => f.sign === "-" && f.amount === null).length;
  const expenseLeft = expenseTarget - spent - recurringOutThisMonth + recurringInThisMonth;
  const dayBudget = expenseLeft / remainingDays;

  const spendPlanRatio = expenseTarget > 0 ? spent / expenseTarget : 0;
  const hasExpensePlan = expenseTarget > 0;

  let pulseAccentLeft;
  let pulseBg;
  let pulseColor;
  let incomeBarClass;
  let forecastBarClass;
  let pulseStatusText;

  if (hasExpensePlan) {
    if (spendPlanRatio > 0.75) {
      pulseAccentLeft = "border-l-red-500";
      pulseBg = "bg-pulse-b";
      pulseColor = "text-danger";
      incomeBarClass = "bg-danger";
      forecastBarClass = "bg-danger";
      pulseStatusText = "Понад 75% запланованого";
    } else if (spendPlanRatio > 0.5) {
      pulseAccentLeft = "border-l-amber-500";
      pulseBg = "bg-pulse-w";
      pulseColor = "text-warning";
      incomeBarClass = "bg-warning";
      forecastBarClass = "bg-warning";
      pulseStatusText = "Понад 50% запланованого";
    } else {
      pulseAccentLeft = "border-l-emerald-500";
      pulseBg = "bg-pulse-ok";
      pulseColor = "text-success";
      incomeBarClass = "bg-success";
      forecastBarClass = "bg-emerald-500";
      pulseStatusText = "В межах плану";
    }
  } else {
    const pulseGood = dayBudget >= 200;
    const pulseWarn = dayBudget >= 0 && dayBudget < 200;
    const pulseBad = dayBudget < 0;
    pulseAccentLeft = pulseGood ? "border-l-emerald-500" : pulseWarn ? "border-l-amber-500" : "border-l-red-500";
    pulseBg = pulseGood ? "bg-pulse-ok" : pulseWarn ? "bg-pulse-w" : "bg-pulse-b";
    pulseColor = pulseGood ? "text-success" : pulseWarn ? "text-warning" : "text-danger";
    incomeBarClass = spent > income ? "bg-danger" : "bg-success";
    forecastBarClass =
      spent > projectedSpend
        ? "bg-danger"
        : projectedSpend > 0 && spent / projectedSpend >= 0.85
          ? "bg-warning"
          : "bg-emerald-500";
    pulseStatusText = pulseBad ? "Перевитрата" : pulseWarn ? "Обережно — майже вичерпано" : "В нормі";
  }

  const firstName = clientInfo?.name?.split(" ")[1] || clientInfo?.name?.split(" ")[0] || "друже";
  const monthBalance = income - spent;
  const spendPct = Math.min(100, income > 0 ? (spent / income) * 100 : 0);
  const dateLabel = now.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  const showMonthForecast = showBalance && daysPassed > 0 && projectedSpend > 0;
  const forecastTrendPct = showMonthForecast ? Math.min(100, Math.round((spent / projectedSpend) * 100)) : 0;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-4 max-w-4xl mx-auto">

        {/* ── Hero (як у прототипі: градієнт + зведення) ── */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-5 shadow-float border border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-emerald-100/90 text-sm">Загальний нетворс</p>
              <p className="text-[11px] text-emerald-200/70 mt-0.5">{firstName} · {dateLabel}</p>
            </div>
          </div>
          <div className={cn("text-[40px] font-bold tracking-tight leading-tight mt-2 tabular-nums", !showBalance && "tracking-widest")}>
            {showBalance ? (
              <>
                {networth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                <span className="text-2xl font-semibold text-emerald-100 ml-1">₴</span>
              </>
            ) : (
              "••••••"
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 text-emerald-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-90" aria-hidden>
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
              <div className="text-[11px] text-emerald-200/80 mb-0.5">На картках</div>
              <div className="font-semibold tabular-nums text-emerald-50">
                {showBalance ? `+${monoTotal.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴` : "••••"}
              </div>
            </div>
            <div className="w-px bg-white/25 hidden sm:block self-stretch min-h-[2.5rem]" />
            <div>
              <div className="text-[11px] text-emerald-200/80 mb-0.5">Борги</div>
              <div className="font-semibold tabular-nums text-emerald-50">
                {showBalance ? `−${totalDebt.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴` : "••••"}
              </div>
            </div>
            <div className="w-px bg-white/25 hidden sm:block self-stretch min-h-[2.5rem]" />
            <div>
              <div className="text-[11px] text-emerald-200/80 mb-0.5">Місяць</div>
              <div className={cn("font-semibold tabular-nums", monthBalance >= 0 ? "text-emerald-50" : "text-amber-200")}>
                {showBalance
                  ? `${monthBalance >= 0 ? "+" : "−"}${Math.abs(monthBalance).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
                  : "••••"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 text-emerald-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span className="text-xs text-subtle">Дохід</span>
            </div>
            <p className="text-xl font-semibold mt-1 tabular-nums text-text">
              {showBalance ? `+${income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}` : "••••"} <span className="text-base font-medium text-muted">₴</span>
            </p>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 text-red-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
              <span className="text-xs text-subtle">Витрати</span>
            </div>
            <p className="text-xl font-semibold mt-1 tabular-nums text-text">
              {showBalance ? `−${spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}` : "••••"} <span className="text-base font-medium text-muted">₴</span>
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
              <p className="text-[11px] text-subtle/80 mt-0.5 capitalize">{dateLabel}</p>
            </div>
            <span className="text-[11px] text-subtle/60 shrink-0 text-right tabular-nums">
              {Math.max(0, daysInMonth - daysPassed)} дн. залишилось
            </span>
          </div>

          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="text-xs text-subtle font-medium">Витрати</div>
              <div className="text-[26px] font-bold tabular-nums mt-1 leading-tight">
                {showBalance ? spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 }) : "••••"}
                {showBalance && <span className="text-base font-medium text-muted ml-1">₴</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-subtle font-medium">Дохід</div>
              <div className="text-[26px] font-bold tabular-nums mt-1 leading-tight text-success">
                {showBalance ? (
                  <>
                    +{income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                    <span className="text-base font-medium text-success/70 ml-1">₴</span>
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
                className={cn("h-full rounded-full transition-all duration-700", incomeBarClass)}
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
              <div className="text-xs font-medium text-subtle">Факт і прогноз витрат</div>
              <p className="text-[11px] text-subtle/80 leading-snug">
                За {daysPassed} {daysPassed === 1 ? "день" : daysPassed < 5 ? "дні" : "дн."} · факт{" "}
                <span className="font-semibold text-text tabular-nums">{spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴</span>
                {" · "}до кінця місяця ~{" "}
                <span className="font-semibold text-text tabular-nums">
                  {Math.round(projectedSpend).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                </span>
              </p>
              <div className="h-2.5 bg-bg rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", forecastBarClass)}
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
              <span className="text-[11px] text-subtle/60">цільова витрата на день</span>
            </div>
            <div className={cn("text-[30px] sm:text-[34px] font-bold leading-tight tabular-nums mt-2", pulseColor, !showBalance && "tracking-widest")}>
              {showBalance ? (
                <>
                  {Math.abs(dayBudget).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                  <span className="text-base font-medium text-subtle ml-1">₴/день</span>
                </>
              ) : (
                "••••"
              )}
            </div>
            <div className={cn("text-sm mt-0.5", pulseColor)}>{pulseStatusText}</div>
            {(recurringOutThisMonth > 0 || recurringInThisMonth > 0) && showBalance && (
              <div className="text-[11px] text-subtle/70 mt-2 leading-relaxed">
                Враховано планових: −{recurringOutThisMonth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} / +
                {recurringInThisMonth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                {unknownOutCount > 0 && ` + ${unknownOutCount} без суми`}
              </div>
            )}
          </div>
        </div>

        {/* ── Networth chart ── */}
        {networthHistory.length >= 2 ? (
          <div className="bg-panel border border-line/60 rounded-2xl px-5 pt-4 pb-3 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-subtle">Динаміка нетворсу</span>
              <span className="text-xs text-subtle/60">{networthHistory.length} міс.</span>
            </div>
            <NetworthChart data={networthHistory} />
          </div>
        ) : (
          <div className="bg-panel border border-dashed border-line/60 rounded-2xl p-6 text-center shadow-card">
            <p className="text-sm text-subtle">Ще мало знімків для графіка нетворсу — з’явиться після кількох змін балансу.</p>
          </div>
        )}

        {/* ── Budget alerts ── */}
        {budgetAlerts.length > 0 && (
          <div className="space-y-1.5">
            {budgetAlerts.map((b, i) => {
              const cat = MCC_CATEGORIES.find(c => c.id === b.categoryId);
              const s = calcCategorySpent(statTx, b.categoryId, txCategories, txSplits);
              const pct = Math.round(s / b.limit * 100);
              return (
                <div key={i} className={cn("rounded-2xl px-4 py-3 flex items-center justify-between border", pct >= 100 ? "bg-danger/8 border-danger/20" : "bg-warning/8 border-warning/20")}>
                  <span className="text-sm font-medium">{cat?.label || b.categoryId}</span>
                  <span className={cn("text-sm font-bold tabular-nums", pct >= 100 ? "text-danger" : "text-warning")}>
                    {pct}% {pct >= 100 ? "⚠ перевищено" : "· майже ліміт"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Plan/Fact ── */}
        {(planIncome > 0 || planExpense > 0 || planSavings > 0) && (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
            <div className="text-xs font-medium text-subtle mb-3">План / Факт</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="text-[11px] text-subtle/60 mb-1">План</div>
                <div className="text-sm text-muted tabular-nums">+{planIncome.toLocaleString("uk-UA")} ₴</div>
                <div className="text-sm text-muted tabular-nums">−{planExpense.toLocaleString("uk-UA")} ₴</div>
                <div className="text-sm text-muted tabular-nums">{planSavings.toLocaleString("uk-UA")} ₴ збер.</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] text-subtle/60 mb-1">Факт</div>
                <div className="text-sm text-success tabular-nums">+{income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴</div>
                <div className="text-sm text-danger tabular-nums">−{spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴</div>
                <div className={cn("text-sm tabular-nums", factSavings >= 0 ? "text-success" : "text-danger")}>
                  {factSavings.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴ збер.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Planned flows ── */}
        {plannedFlows.length > 0 && (
          <div className="bg-panel border border-line/60 rounded-2xl overflow-hidden shadow-card">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-subtle">Найближчі платежі</span>
              <button onClick={() => onNavigate("budgets")} className="text-xs text-primary/80 hover:text-primary transition-colors py-2 px-1 min-h-[36px]">Усі →</button>
            </div>
            <div className="px-5 pb-3">
              {plannedFlows.slice(0, 5).map(f => <FlowRow key={f.id} flow={f} showAmount={showBalance} />)}
            </div>
          </div>
        )}

        {/* ── Limits ── */}
        {limitBudgets.length > 0 && (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card space-y-4">
            <div className="text-xs font-medium text-subtle">Ліміти</div>
            {limitBudgets.map((b, i) => {
              const cat = MCC_CATEGORIES.find(c => c.id === b.categoryId);
              const bspent = calcCategorySpent(statTx, b.categoryId, txCategories, txSplits);
              const pct = Math.min(100, b.limit > 0 ? Math.round(bspent / b.limit * 100) : 0);
              const over = pct >= 90;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{cat?.label || "—"}</span>
                    <span className={cn("text-xs tabular-nums", over ? "text-danger" : "text-subtle")}>
                      {bspent.toLocaleString("uk-UA")} / {b.limit.toLocaleString("uk-UA")} ₴
                    </span>
                  </div>
                  <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700", over ? "bg-danger" : "bg-success")} style={{ width: `${pct}%` }} />
                  </div>
                  {over && <div className="text-[11px] text-danger mt-1">{pct}% — ліміт майже вичерпано</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Goals ── */}
        {goalBudgets.length > 0 && (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card space-y-4">
            <div className="text-xs font-medium text-subtle">Цілі</div>
            {goalBudgets.map((b, i) => {
              const saved = b.savedAmount || 0;
              const pct = Math.min(100, b.targetAmount > 0 ? Math.round(saved / b.targetAmount * 100) : 0);
              const daysLeft = b.targetDate ? Math.ceil((new Date(b.targetDate) - now) / 86400000) : null;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">{b.emoji || "🎯"} {b.name}</span>
                    <span className="text-xs text-subtle tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[11px] text-subtle/70 tabular-nums">{saved.toLocaleString("uk-UA")} / {b.targetAmount.toLocaleString("uk-UA")} ₴</span>
                    <span className="text-[11px] text-subtle/70">{daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} дн.` : "Прострочено") : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Category chart ── */}
        {catSpends.length > 0 ? (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
            <div className="text-xs font-medium text-subtle mb-4">Витрати за категоріями</div>
            <CategoryChart
              data={catSpends.slice(0, 6)}
              onBarClick={onCategoryClick ? (catId) => { onCategoryClick(catId); onNavigate?.("transactions"); } : undefined}
            />
          </div>
        ) : (
          <div className="bg-panel border border-dashed border-line/60 rounded-2xl p-8 text-center shadow-card">
            <p className="text-sm text-subtle">Поки немає витрат за категоріями цього місяця.</p>
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
        {loadingTx && <p className="text-center text-xs text-subtle py-4">Оновлення...</p>}
      </div>
    </div>
  );
}
