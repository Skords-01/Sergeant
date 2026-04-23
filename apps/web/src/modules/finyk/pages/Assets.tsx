import { useMemo, useState } from "react";
import { DebtCard } from "../components/DebtCard";
import { SubCard } from "../components/SubCard";
import { RecurringSuggestions } from "../components/RecurringSuggestions";
import { TxRow } from "../components/TxRow";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { Icon, type IconName } from "@shared/components/ui/Icon";
import {
  getAccountLabel,
  getMonoDebt,
  isMonoDebt,
  getDebtPaid,
  getRecvPaid,
  getMonoTotals,
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getReceivableEffectiveTotal,
} from "../utils";
import {
  getDebtTxRole,
  getReceivableTxRole,
} from "@sergeant/finyk-domain/domain/debtEngine";
import { getSubscriptionAmountMeta } from "@sergeant/finyk-domain/domain/subscriptionUtils";
import { cn } from "@shared/lib/cn";
import { openHubModule } from "@shared/lib/hubNav";
import { notifyFinykRoutineCalendarSync } from "../hubRoutineSync.js";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseExpenseSpeech as parseExpenseVoice } from "@sergeant/shared";

// Local date + billing helpers mirrored from Overview.tsx. Kept inline so the
// Assets page doesn't need to import non-exported private helpers.
const parseLocalDate = (isoDate: string | undefined | null) => {
  const [y, m, d] = (isoDate || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const getNextBillingDate = (billingDay: number, now: Date) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  let d = new Date(y, m, Math.min(billingDay, new Date(y, m + 1, 0).getDate()));
  if (d < new Date(y, m, now.getDate())) {
    d = new Date(
      y,
      m + 1,
      Math.min(billingDay, new Date(y, m + 2, 0).getDate()),
    );
  }
  return d;
};
const formatShortDate = (d: Date) =>
  d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });

type SectionBarProps = {
  title: string;
  iconName: IconName;
  iconTone?: "success" | "danger" | "muted";
  summary?: string | null;
  open: boolean;
  onToggle: () => void;
};

type UpcomingCharge = {
  label: string;
  amount: number;
  sign: "-" | "+";
  dueDate: Date;
};

function formatRelativeDue(dueDate: Date, todayStart: Date) {
  const days = Math.ceil((dueDate.getTime() - todayStart.getTime()) / 86400000);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "завтра";
  if (days <= 7) return `через ${days} дн`;
  return formatShortDate(dueDate);
}

function AssetsLiabilitiesBar({
  assets,
  liabilities,
}: {
  assets: number;
  liabilities: number;
}) {
  const total = assets + liabilities;
  if (total <= 0) return null;
  const assetsPct = Math.round((assets / total) * 100);
  const liabilitiesPct = 100 - assetsPct;
  return (
    <div className="mt-3">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={`Активи ${assetsPct}% · Пасиви ${liabilitiesPct}%`}
      >
        <div className="bg-emerald-300/90" style={{ width: `${assetsPct}%` }} />
        <div
          className="bg-rose-400/80"
          style={{ width: `${liabilitiesPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-emerald-100/80 mt-1.5">
        <span>Активи {assetsPct}%</span>
        <span>Пасиви {liabilitiesPct}%</span>
      </div>
    </div>
  );
}

type StatTileProps = {
  iconName: IconName;
  iconTone: "success" | "danger" | "muted";
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
};

function StatTile({
  iconName,
  iconTone,
  label,
  value,
  hint,
  onClick,
}: StatTileProps) {
  const toneClass =
    iconTone === "success"
      ? "text-success"
      : iconTone === "danger"
        ? "text-danger"
        : "text-muted";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={cn(
        "flex-1 min-w-[9.5rem] shrink-0 text-left px-3 py-2.5",
        "bg-panelHi border border-line rounded-2xl",
        "transition-colors",
        onClick && "hover:border-muted/50 active:scale-[0.99]",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span className={cn("inline-flex", toneClass)} aria-hidden>
          <Icon name={iconName} size={14} />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-sm font-bold text-text mt-1 truncate">{value}</div>
      {hint && (
        <div className="text-[11px] text-subtle mt-0.5 truncate">{hint}</div>
      )}
    </Wrapper>
  );
}

function AssetsStatsStrip({
  subsMonthly,
  subsCount,
  nextCharge,
  urgentLiability,
  todayStart,
  showBalance,
  onOpenSubs,
  onOpenLiabilities,
}: {
  subsMonthly: number;
  subsCount: number;
  nextCharge: UpcomingCharge | null;
  urgentLiability: { name: string; remaining: number; dueDate: Date } | null;
  todayStart: Date;
  showBalance: boolean;
  onOpenSubs: () => void;
  onOpenLiabilities: () => void;
}) {
  const showSubsTile = subsCount > 0;
  const showNextTile = Boolean(nextCharge);
  const showUrgentTile = Boolean(urgentLiability);
  if (!showSubsTile && !showNextTile && !showUrgentTile) return null;
  const hideNumbers = !showBalance;
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1 scrollbar-hidden"
      role="list"
    >
      {showSubsTile && (
        <StatTile
          iconName="refresh-cw"
          iconTone="muted"
          label="Підписки · міс"
          value={
            hideNumbers
              ? "••••"
              : `${subsMonthly.toLocaleString("uk-UA", {
                  maximumFractionDigits: 0,
                })} ₴`
          }
          hint={`${subsCount} активн${subsCount === 1 ? "а" : "их"}`}
          onClick={onOpenSubs}
        />
      )}
      {showNextTile && nextCharge && (
        <StatTile
          iconName="calendar"
          iconTone={nextCharge.sign === "-" ? "danger" : "success"}
          label="Наступний платіж"
          value={
            hideNumbers
              ? "••••"
              : `${nextCharge.sign}${nextCharge.amount.toLocaleString("uk-UA", {
                  maximumFractionDigits: 0,
                })} ₴`
          }
          hint={`${nextCharge.label} · ${formatRelativeDue(
            nextCharge.dueDate,
            todayStart,
          )}`}
        />
      )}
      {showUrgentTile && urgentLiability && (
        <StatTile
          iconName="alert"
          iconTone="danger"
          label="Пасив з дедлайном"
          value={
            hideNumbers
              ? "••••"
              : `−${urgentLiability.remaining.toLocaleString("uk-UA", {
                  maximumFractionDigits: 0,
                })} ₴`
          }
          hint={`${urgentLiability.name} · ${formatRelativeDue(
            urgentLiability.dueDate,
            todayStart,
          )}`}
          onClick={onOpenLiabilities}
        />
      )}
    </div>
  );
}

function QuickActionButton({
  iconName,
  label,
  onClick,
}: {
  iconName: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs text-muted border border-dashed border-line rounded-2xl hover:border-primary hover:text-primary transition-colors"
    >
      <Icon name={iconName} size={18} />
      <span className="font-medium">+ {label}</span>
    </button>
  );
}

function SectionBar({
  title,
  iconName,
  iconTone = "muted",
  summary,
  open,
  onToggle,
}: SectionBarProps) {
  const toneClass =
    iconTone === "success"
      ? "text-success"
      : iconTone === "danger"
        ? "text-danger"
        : "text-muted";
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-panelHi border border-line rounded-2xl mb-2 text-left transition-colors hover:border-muted/50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "inline-flex items-center justify-center shrink-0",
            toneClass,
          )}
          aria-hidden
        >
          <Icon name={iconName} size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-text truncate">{title}</div>
          {summary && (
            <div className="text-xs text-muted mt-0.5 truncate">{summary}</div>
          )}
        </div>
      </div>
      <span className="text-xs text-muted shrink-0 ml-2">
        {open ? "Згорнути ↑" : "Розкласти ↓"}
      </span>
    </button>
  );
}

export function Assets({
  mono,
  storage,
  showBalance = true,
  initialOpenDebt = false,
}) {
  const { accounts, transactions } = mono;
  const {
    hiddenAccounts,
    manualAssets,
    setManualAssets,
    manualDebts,
    setManualDebts,
    receivables,
    setReceivables,
    toggleLinkedTx,
    subscriptions,
    setSubscriptions,
    updateSubscription,
    addSubscriptionFromRecurring,
    dismissedRecurring,
    dismissRecurring,
    excludedTxIds,
    monoDebtLinkedTxIds,
    toggleMonoDebtTx,
    customCategories,
  } = storage;

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(initialOpenDebt);
  const [showRecvForm, setShowRecvForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: "",
    amount: "",
    currency: "UAH",
    emoji: "💰",
  });
  const [newDebt, setNewDebt] = useState({
    name: "",
    emoji: "💸",
    totalAmount: "",
    dueDate: "",
  });
  const [newRecv, setNewRecv] = useState({
    name: "",
    emoji: "👤",
    amount: "",
    note: "",
    dueDate: "",
  });
  const [newSub, setNewSub] = useState<{
    name: string;
    emoji: string;
    keyword: string;
    billingDay: string | number;
    currency: string;
  }>({
    name: "",
    emoji: "📱",
    keyword: "",
    billingDay: "",
    currency: "UAH",
  });
  const [txPicker, setTxPicker] = useState(null);
  const [open, setOpen] = useState({
    subscriptions: false,
    assets: false,
    liabilities: initialOpenDebt,
  });

  const { balance: monoTotal, debt: monoTotalDebt } = getMonoTotals(
    accounts,
    hiddenAccounts,
  );
  const monoDebtAccounts = accounts.filter((a) => isMonoDebt(a));
  const manualDebtTotal = manualDebts.reduce(
    (s, d) => s + calcDebtRemaining(d, transactions),
    0,
  );
  const totalDebt = monoTotalDebt + manualDebtTotal;
  const totalReceivable = receivables.reduce(
    (s, r) => s + calcReceivableRemaining(r, transactions),
    0,
  );
  const manualAssetTotal = manualAssets
    .filter((a) => a.currency === "UAH")
    .reduce((s, a) => s + Number(a.amount), 0);
  const networth = monoTotal + manualAssetTotal + totalReceivable - totalDebt;
  const totalAssets = monoTotal + manualAssetTotal + totalReceivable;

  // Stats strip + upcoming-charge feed. `todayStart` is pinned to the
  // mount-time midnight via lazy initialiser so `useMemo` deps below stay
  // referentially stable for the session — date only matters for day-level
  // comparisons ("next billing date", "days until due"), so a frozen
  // reference is safer than `new Date()` each render.
  const [todayStart] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  });

  const subsMonthlyTotal = useMemo(
    () =>
      subscriptions.reduce((sum, sub) => {
        const { amount, currency } = getSubscriptionAmountMeta(
          sub,
          transactions,
        );
        if (!amount || currency !== "₴") return sum;
        return sum + amount;
      }, 0),
    [subscriptions, transactions],
  );

  // Combined upcoming feed: next subscription billing + manual debts/
  // receivables with a concrete dueDate. Sorted by soonest, takes earliest.
  const nextCharge = useMemo(() => {
    const items: Array<{
      label: string;
      amount: number;
      sign: "-" | "+";
      dueDate: Date;
    }> = [];
    for (const sub of subscriptions) {
      const { amount, currency } = getSubscriptionAmountMeta(sub, transactions);
      if (!amount || currency !== "₴") continue;
      items.push({
        label: sub.name,
        amount,
        sign: "-",
        dueDate: getNextBillingDate(Number(sub.billingDay), todayStart),
      });
    }
    for (const d of manualDebts) {
      if (!d.dueDate) continue;
      const remaining = calcDebtRemaining(d, transactions);
      if (remaining <= 0) continue;
      items.push({
        label: d.name,
        amount: remaining,
        sign: "-",
        dueDate: parseLocalDate(d.dueDate),
      });
    }
    for (const r of receivables) {
      if (!r.dueDate) continue;
      const remaining = calcReceivableRemaining(r, transactions);
      if (remaining <= 0) continue;
      items.push({
        label: r.name,
        amount: remaining,
        sign: "+",
        dueDate: parseLocalDate(r.dueDate),
      });
    }
    items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const soonest = items.find(
      (it) => it.dueDate.getTime() >= todayStart.getTime(),
    );
    return soonest ?? null;
  }, [subscriptions, manualDebts, receivables, transactions, todayStart]);

  // Largest manual debt that still has a dueDate — surfaces the biggest
  // time-sensitive obligation without forcing users to expand the section.
  const urgentLiability = useMemo(() => {
    const withDue = manualDebts
      .filter((d) => d.dueDate)
      .map((d) => ({
        name: d.name,
        remaining: calcDebtRemaining(d, transactions),
        dueDate: parseLocalDate(d.dueDate),
      }))
      .filter((d) => d.remaining > 0);
    if (withDue.length === 0) return null;
    return withDue.reduce((a, b) => (a.remaining >= b.remaining ? a : b));
  }, [manualDebts, transactions]);

  // Quick-action helpers: open the relevant section + reveal its form in a
  // single tap, so the user doesn't expand → scroll → tap "+ Додати".
  const openSubscriptionForm = () => {
    setOpen((v) => ({ ...v, subscriptions: true }));
    setShowSubForm(true);
  };
  const openAssetForm = () => {
    setOpen((v) => ({ ...v, assets: true }));
    setShowAssetForm(true);
  };
  const openDebtForm = () => {
    setOpen((v) => ({ ...v, liabilities: true }));
    setShowDebtForm(true);
  };

  if (txPicker) {
    // --- Mono credit card repayment linking ---
    if (txPicker.type === "monoDebt") {
      const account = accounts.find((a) => a.id === txPicker.id);
      const linkedIds = monoDebtLinkedTxIds[txPicker.id] || [];
      const paid = transactions
        .filter((t) => linkedIds.includes(t.id))
        .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
      const remaining = getMonoDebt(account);
      const total = paid + remaining;
      const label = getAccountLabel(account);

      const isSuggested = (t) => t._accountId === txPicker.id && t.amount > 0;

      return (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg sticky top-0 z-10">
            <button
              onClick={() => setTxPicker(null)}
              className="text-sm text-muted hover:text-text transition-colors"
            >
              ← Назад
            </button>
            <span className="text-sm font-bold">Погашення: {label}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
              <Card variant="flat" radius="md" className="mb-3">
                <div className="text-xs text-subtle mb-1">{label}</div>
                <div className="text-2xl font-extrabold text-danger">
                  −
                  {remaining.toLocaleString("uk-UA", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  ₴ залишок боргу
                </div>
                <div className="text-xs text-subtle mt-1">
                  Погашено цього місяця:{" "}
                  {paid.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                  · Базовий борг:{" "}
                  {total.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}{" "}
                  ₴
                </div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-danger rounded-full transition-all duration-500"
                    style={{
                      width: `${total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </Card>
              <p className="text-xs text-subtle mb-3 px-1">
                Тапни транзакцію щоб прив&apos;язати як погашення. Виділені
                зеленим — автоматично виявлені поповнення картки.
              </p>
              {transactions.map((t, i) => {
                const isLinked = linkedIds.includes(t.id);
                const suggested = isSuggested(t);
                return (
                  <div key={i}>
                    {suggested && !isLinked && (
                      <div className="text-2xs font-semibold text-success px-1 pt-1">
                        ↑ Поповнення картки
                      </div>
                    )}
                    <TxRow
                      tx={t}
                      highlighted={isLinked}
                      onClick={() => toggleMonoDebtTx(txPicker.id, t.id)}
                      accounts={accounts}
                      hideAmount={!showBalance}
                      customCategories={customCategories}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (txPicker.type === "sub") {
      const sub = subscriptions.find((s) => s.id === txPicker.subId);
      if (!sub) {
        return (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg sticky top-0 z-10">
              <button
                type="button"
                onClick={() => setTxPicker(null)}
                className="text-sm text-muted hover:text-text transition-colors"
              >
                ← Назад
              </button>
            </div>
          </div>
        );
      }
      const linkedId = sub.linkedTxId;
      const expenses = transactions
        .filter((t) => t.amount < 0)
        .sort((a, b) => (b.time || 0) - (a.time || 0));
      return (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg sticky top-0 z-10">
            <button
              type="button"
              onClick={() => setTxPicker(null)}
              className="text-sm text-muted hover:text-text transition-colors"
            >
              ← Назад
            </button>
            <span className="text-sm font-bold">
              Транзакція для «{sub.name}»
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
              <Card variant="flat" radius="md" className="mb-4">
                <p className="text-xs text-subtle leading-relaxed">
                  Обери списання (наприклад через Apple/Google). День місяця з
                  транзакції підставиться в «день списання»; сума піде в огляд і
                  в Рутину.
                  {linkedId && (
                    <button
                      type="button"
                      className="block mt-2 text-sm font-semibold text-danger hover:underline"
                      onClick={() => {
                        updateSubscription(sub.id, { linkedTxId: null });
                        setTxPicker(null);
                      }}
                    >
                      Зняти привʼязку
                    </button>
                  )}
                </p>
              </Card>
              {expenses.map((t, i) => {
                const isLinked = linkedId === t.id;
                return (
                  <TxRow
                    key={t.id || i}
                    tx={t}
                    highlighted={isLinked}
                    customCategories={customCategories}
                    onClick={() => {
                      if (isLinked) {
                        updateSubscription(sub.id, { linkedTxId: null });
                      } else {
                        const bd = new Date((t.time || 0) * 1000).getDate();
                        updateSubscription(sub.id, {
                          linkedTxId: t.id,
                          billingDay: bd,
                        });
                      }
                      setTxPicker(null);
                    }}
                    accounts={accounts}
                    hideAmount={!showBalance}
                  />
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // --- Manual debt / receivable linking ---
    const isDebt = txPicker.type === "debt";
    const items = isDebt ? manualDebts : receivables;
    const item = items.find((d) => d.id === txPicker.id);
    const linked = item?.linkedTxIds || [];
    const paid = isDebt
      ? getDebtPaid(item, transactions)
      : getRecvPaid(item, transactions);
    const total = isDebt
      ? getDebtEffectiveTotal(item, transactions)
      : getReceivableEffectiveTotal(item, transactions);
    const remaining = isDebt
      ? calcDebtRemaining(item, transactions)
      : calcReceivableRemaining(item, transactions);
    const getTxRole = (tx) =>
      isDebt ? getDebtTxRole(tx) : getReceivableTxRole(tx);

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg sticky top-0 z-10">
          <button
            onClick={() => setTxPicker(null)}
            className="text-sm text-muted hover:text-text transition-colors"
          >
            ← Назад
          </button>
          <span className="text-sm font-bold">
            {isDebt ? "Транзакції по пасиву" : "Транзакції по активу"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
            <Card variant="flat" radius="md" className="mb-4">
              <div className="text-xs text-subtle">
                {item?.emoji} {item?.name}
              </div>
              <div
                className={cn(
                  "text-2xl font-extrabold mt-1",
                  isDebt ? "text-danger" : "text-success",
                )}
              >
                {isDebt ? "−" : "+"}
                {remaining.toLocaleString("uk-UA")} ₴ залишок
              </div>
              <div className="text-xs text-subtle mt-1">
                Сплачено: {paid.toLocaleString("uk-UA")} з{" "}
                {total?.toLocaleString("uk-UA")} ₴
              </div>
            </Card>
            {transactions.map((t, i) => {
              const isLinked = linked.includes(t.id);
              const role = isLinked ? getTxRole(t) : null;
              return (
                <div key={i}>
                  {isLinked && (
                    <div
                      className="text-xs font-bold px-1 py-1"
                      style={{ color: role.color }}
                    >
                      {role.label}
                    </div>
                  )}
                  <TxRow
                    tx={t}
                    highlighted={isLinked}
                    onClick={() =>
                      toggleLinkedTx(txPicker.id, t.id, txPicker.type)
                    }
                    hideAmount={!showBalance}
                    customCategories={customCategories}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-1">
        {/* Networth */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white rounded-2xl p-5 mb-3 border border-white/10 shadow-float">
          <div className="text-xs text-emerald-100/90 mb-1">
            Загальний нетворс
          </div>
          <div
            className={cn(
              "text-3xl font-extrabold tracking-tight",
              !showBalance && "tracking-widest",
            )}
          >
            {showBalance
              ? `${networth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "••••••"}
          </div>
          <div className="text-xs text-emerald-100/85 mt-1">
            {showBalance ? (
              <>
                Активи:{" "}
                {totalAssets.toLocaleString("uk-UA", {
                  maximumFractionDigits: 0,
                })}{" "}
                ₴ · Пасиви: −
                {totalDebt.toLocaleString("uk-UA", {
                  maximumFractionDigits: 0,
                })}{" "}
                ₴
              </>
            ) : (
              "Суми приховано"
            )}
          </div>
          {/* D — proportional assets/liabilities bar. Only rendered when the
              user has data in both buckets, so a fresh account isn't greeted
              with an empty sliver. */}
          {showBalance && totalAssets + totalDebt > 0 && (
            <AssetsLiabilitiesBar
              assets={totalAssets}
              liabilities={totalDebt}
            />
          )}
        </div>

        {/* C — compact stats strip. Surfaces numbers that would otherwise be
            hidden inside collapsed sections: subs monthly total, next due
            charge, biggest liability with a deadline. Horizontal scroll on
            mobile, grid on wider screens. Only tiles with data render, so
            the strip disappears entirely for empty accounts. */}
        <AssetsStatsStrip
          subsMonthly={subsMonthlyTotal}
          subsCount={subscriptions.length}
          nextCharge={nextCharge}
          urgentLiability={urgentLiability}
          todayStart={todayStart}
          showBalance={showBalance}
          onOpenSubs={() => setOpen((v) => ({ ...v, subscriptions: true }))}
          onOpenLiabilities={() =>
            setOpen((v) => ({ ...v, liabilities: true }))
          }
        />

        {/* E — quick-action CTAs. Each opens the respective section and its
            inline form in one tap, collapsing the "expand → scroll → tap +"
            flow into a single gesture. */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <QuickActionButton
            iconName="refresh-cw"
            label="Підписка"
            onClick={openSubscriptionForm}
          />
          <QuickActionButton
            iconName="trending-up"
            label="Актив"
            onClick={openAssetForm}
          />
          <QuickActionButton
            iconName="trending-down"
            label="Пасив"
            onClick={openDebtForm}
          />
        </div>

        {/* Auto-detected recurring suggestions (renders nothing if empty) */}
        <RecurringSuggestions
          transactions={transactions}
          subscriptions={subscriptions}
          dismissedRecurring={dismissedRecurring}
          excludedTxIds={excludedTxIds}
          onAdd={(candidate) => addSubscriptionFromRecurring?.(candidate)}
          onDismiss={(key) => dismissRecurring?.(key)}
        />

        {/* Subscriptions section */}
        <SectionBar
          title="Підписки"
          iconName="refresh-cw"
          summary={`${subscriptions.length} активн${
            subscriptions.length === 1 ? "а" : "их"
          }`}
          open={open.subscriptions}
          onToggle={() =>
            setOpen((v) => ({ ...v, subscriptions: !v.subscriptions }))
          }
        />
        {open.subscriptions && (
          <div className="mb-3 space-y-0">
            {subscriptions.length > 0 && (
              <button
                type="button"
                onClick={() => openHubModule("routine", "")}
                className="w-full text-xs text-muted hover:text-text transition-colors pb-2 flex items-center justify-center gap-1.5"
              >
                <Icon name="calendar" size={14} aria-hidden />
                <span>Побачити у календарі Рутини</span>
                <Icon name="chevron-right" size={14} aria-hidden />
              </button>
            )}
            {subscriptions.map((sub, i) => (
              <SubCard
                key={sub.id}
                sub={sub}
                transactions={transactions}
                onDelete={() => {
                  setSubscriptions((ss) => ss.filter((_, j) => j !== i));
                  notifyFinykRoutineCalendarSync();
                }}
                onEdit={(updated) => {
                  setSubscriptions((ss) =>
                    ss.map((s, j) => (j === i ? { ...s, ...updated } : s)),
                  );
                  notifyFinykRoutineCalendarSync();
                }}
                onLinkTransactions={() =>
                  setTxPicker({ type: "sub", subId: sub.id })
                }
              />
            ))}
            {showSubForm ? (
              <Card variant="flat" radius="md" className="space-y-3 mt-2">
                <Input
                  placeholder="Назва"
                  value={newSub.name}
                  onChange={(e) =>
                    setNewSub((a) => ({ ...a, name: e.target.value }))
                  }
                />
                <Input
                  placeholder="Ключове слово з транзакції"
                  value={newSub.keyword}
                  onChange={(e) =>
                    setNewSub((a) => ({ ...a, keyword: e.target.value }))
                  }
                />
                <Input
                  placeholder="День списання (1-31)"
                  type="number"
                  min="1"
                  max="31"
                  value={newSub.billingDay}
                  onChange={(e) =>
                    setNewSub((a) => ({
                      ...a,
                      billingDay: Number(e.target.value),
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => {
                      if (newSub.name && newSub.billingDay) {
                        setSubscriptions((ss) => [
                          ...ss,
                          { ...newSub, id: Date.now().toString() },
                        ]);
                        notifyFinykRoutineCalendarSync();
                        setNewSub({
                          name: "",
                          emoji: "📱",
                          keyword: "",
                          billingDay: "",
                          currency: "UAH",
                        });
                        setShowSubForm(false);
                      }
                    }}
                  >
                    Додати
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSubForm(false)}
                  >
                    Скасувати
                  </Button>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setShowSubForm(true)}
                className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors mt-2"
              >
                + Додати підписку
              </button>
            )}
          </div>
        )}

        {/* Assets section */}
        <SectionBar
          title="Активи"
          iconName="trending-up"
          iconTone="success"
          summary={`+${totalAssets.toLocaleString("uk-UA", {
            maximumFractionDigits: 0,
          })} ₴`}
          open={open.assets}
          onToggle={() => setOpen((v) => ({ ...v, assets: !v.assets }))}
        />
        {open.assets && (
          <div className="mb-3 space-y-2">
            <SectionHeading as="div" size="sm" className="pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="credit-card" size={14} className="text-muted" />
                Картки Monobank
              </span>
            </SectionHeading>
            {accounts
              .filter((a) => !hiddenAccounts.includes(a.id))
              .map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 px-1 border-b border-line last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-muted"
                      aria-hidden
                    >
                      <Icon name="credit-card" size={16} />
                    </span>
                    <div>
                      <div className="text-sm font-medium">
                        {getAccountLabel(a)}
                      </div>
                      <div className="text-xs text-subtle mt-0.5">
                        {(a.balance / 100).toLocaleString("uk-UA", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {a.currencyCode === 980
                          ? "₴"
                          : a.currencyCode === 840
                            ? "$"
                            : "€"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            <SectionHeading as="div" size="sm" className="pt-2">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="hand-coins" size={14} className="text-success" />
                Мені винні
              </span>
            </SectionHeading>
            {receivables.map((r) => (
              <DebtCard
                key={r.id}
                name={r.name}
                emoji={r.emoji}
                remaining={calcReceivableRemaining(r, transactions)}
                paid={getRecvPaid(r, transactions)}
                total={getReceivableEffectiveTotal(r, transactions)}
                dueDate={r.dueDate}
                isReceivable
                onDelete={() =>
                  setReceivables((rs) => rs.filter((x) => x.id !== r.id))
                }
                onLink={() => setTxPicker({ id: r.id, type: "recv" })}
                linkedCount={r.linkedTxIds?.length || 0}
              />
            ))}
            {showRecvForm ? (
              <Card variant="flat" radius="md" className="space-y-3">
                <Input
                  placeholder="Ім'я або назва"
                  value={newRecv.name}
                  onChange={(e) =>
                    setNewRecv((a) => ({ ...a, name: e.target.value }))
                  }
                />
                <Input
                  placeholder="Сума ₴"
                  type="number"
                  value={newRecv.amount}
                  onChange={(e) =>
                    setNewRecv((a) => ({ ...a, amount: e.target.value }))
                  }
                />
                <Input
                  placeholder="Нотатка (необов'язково)"
                  value={newRecv.note}
                  onChange={(e) =>
                    setNewRecv((a) => ({ ...a, note: e.target.value }))
                  }
                />
                <Input
                  type="date"
                  value={newRecv.dueDate}
                  onChange={(e) =>
                    setNewRecv((a) => ({ ...a, dueDate: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => {
                      if (newRecv.name && newRecv.amount) {
                        setReceivables((rs) => [
                          ...rs,
                          {
                            ...newRecv,
                            id: Date.now().toString(),
                            amount: Number(newRecv.amount),
                            linkedTxIds: [],
                          },
                        ]);
                        setNewRecv({
                          name: "",
                          emoji: "👤",
                          amount: "",
                          note: "",
                          dueDate: "",
                        });
                        setShowRecvForm(false);
                      }
                    }}
                  >
                    Додати
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRecvForm(false)}
                  >
                    Скасувати
                  </Button>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setShowRecvForm(true)}
                className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors"
              >
                + Додати актив «мені винні»
              </button>
            )}

            <SectionHeading as="div" size="sm" className="pt-2">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="piggy-bank" size={14} className="text-muted" />
                Інші активи
              </span>
            </SectionHeading>
            {manualAssets.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-text"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{a.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-subtle">{a.currency}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-success">
                    {Number(a.amount).toLocaleString("uk-UA")}{" "}
                    {a.currency === "UAH"
                      ? "₴"
                      : a.currency === "USD"
                        ? "$"
                        : a.currency}
                  </span>
                  <button
                    onClick={() =>
                      setManualAssets((as) => as.filter((_, j) => j !== i))
                    }
                    className="text-subtle hover:text-danger text-sm transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
            {showAssetForm ? (
              <Card variant="flat" radius="md" className="space-y-3">
                <Input
                  placeholder="Назва"
                  value={newAsset.name}
                  onChange={(e) =>
                    setNewAsset((a) => ({ ...a, name: e.target.value }))
                  }
                />
                <Input
                  placeholder="Сума"
                  type="number"
                  value={newAsset.amount}
                  onChange={(e) =>
                    setNewAsset((a) => ({ ...a, amount: e.target.value }))
                  }
                />
                <select
                  className="input-focus-finyk w-full h-11 rounded-2xl border border-line bg-panelHi px-4 text-text"
                  value={newAsset.currency}
                  onChange={(e) =>
                    setNewAsset((a) => ({ ...a, currency: e.target.value }))
                  }
                >
                  <option>UAH</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>BTC</option>
                </select>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => {
                      if (newAsset.name && newAsset.amount) {
                        setManualAssets((a) => [...a, newAsset]);
                        setNewAsset({
                          name: "",
                          amount: "",
                          currency: "UAH",
                          emoji: "💰",
                        });
                        setShowAssetForm(false);
                      }
                    }}
                  >
                    Додати
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAssetForm(false)}
                  >
                    Скасувати
                  </Button>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setShowAssetForm(true)}
                className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors"
              >
                + Додати актив
              </button>
            )}
          </div>
        )}

        {/* Liabilities section */}
        <SectionBar
          title="Пасиви"
          iconName="trending-down"
          iconTone="danger"
          summary={`−${totalDebt.toLocaleString("uk-UA", {
            maximumFractionDigits: 0,
          })} ₴`}
          open={open.liabilities}
          onToggle={() =>
            setOpen((v) => ({ ...v, liabilities: !v.liabilities }))
          }
        />
        {open.liabilities && (
          <div className="mb-3 space-y-0">
            {monoDebtAccounts.map((a, i) => {
              const linkedIds = monoDebtLinkedTxIds[a.id] || [];
              const paidFromLinked = transactions
                .filter((t) => linkedIds.includes(t.id))
                .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
              const remaining = getMonoDebt(a);
              const volatileTotal = paidFromLinked + remaining;
              return (
                <DebtCard
                  key={i}
                  name={getAccountLabel(a)}
                  emoji="🖤"
                  remaining={remaining}
                  paid={paidFromLinked}
                  total={volatileTotal}
                  onLink={() => setTxPicker({ id: a.id, type: "monoDebt" })}
                  linkedCount={linkedIds.length}
                />
              );
            })}
            {manualDebts.map((d) => (
              <DebtCard
                key={d.id}
                name={d.name}
                emoji={d.emoji}
                remaining={calcDebtRemaining(d, transactions)}
                paid={getDebtPaid(d, transactions)}
                total={getDebtEffectiveTotal(d, transactions)}
                dueDate={d.dueDate}
                onDelete={() =>
                  setManualDebts((ds) => ds.filter((x) => x.id !== d.id))
                }
                onLink={() => setTxPicker({ id: d.id, type: "debt" })}
                linkedCount={d.linkedTxIds?.length || 0}
              />
            ))}
            {showDebtForm ? (
              <Card variant="flat" radius="md" className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Назва пасиву (кредит, борг…)"
                    value={newDebt.name}
                    onChange={(e) =>
                      setNewDebt((a) => ({ ...a, name: e.target.value }))
                    }
                  />
                  <VoiceMicButton
                    size="md"
                    label="Голосовий ввід"
                    onResult={(transcript) => {
                      const parsed = parseExpenseVoice(transcript);
                      if (!parsed) return;
                      setNewDebt((a) => ({
                        ...a,
                        name: parsed.name || a.name,
                        totalAmount:
                          parsed.amount != null
                            ? String(Math.round(parsed.amount))
                            : a.totalAmount,
                      }));
                    }}
                  />
                </div>
                <Input
                  placeholder="Загальна сума ₴"
                  type="number"
                  value={newDebt.totalAmount}
                  onChange={(e) =>
                    setNewDebt((a) => ({ ...a, totalAmount: e.target.value }))
                  }
                />
                <Input
                  type="date"
                  value={newDebt.dueDate}
                  onChange={(e) =>
                    setNewDebt((a) => ({ ...a, dueDate: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => {
                      if (newDebt.name && newDebt.totalAmount) {
                        setManualDebts((ds) => [
                          ...ds,
                          {
                            ...newDebt,
                            id: Date.now().toString(),
                            totalAmount: Number(newDebt.totalAmount),
                            linkedTxIds: [],
                          },
                        ]);
                        setNewDebt({
                          name: "",
                          emoji: "💸",
                          totalAmount: "",
                          dueDate: "",
                        });
                        setShowDebtForm(false);
                      }
                    }}
                  >
                    Додати
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDebtForm(false)}
                  >
                    Скасувати
                  </Button>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setShowDebtForm(true)}
                className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors"
              >
                + Додати пасив
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
