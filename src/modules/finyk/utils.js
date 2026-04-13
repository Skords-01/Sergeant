import {
  MCC_CATEGORIES,
  INCOME_CATEGORIES,
  CURRENCY,
  INTERNAL_TRANSFER_ID,
} from "./constants";
import {
  getDebtPaid as debtEngineGetDebtPaid,
  getReceivablePaid,
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getReceivableEffectiveTotal,
} from "./domain/debtEngine";

export {
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getReceivableEffectiveTotal,
};

function resolveExpenseOverride(overrideId, customCategories = []) {
  if (!overrideId) return null;
  const fromMcc = MCC_CATEGORIES.find((c) => c.id === overrideId);
  if (fromMcc) return fromMcc;
  const custom = customCategories.find((c) => c.id === overrideId);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      mccs: [],
      keywords: [],
    };
  }
  return null;
}

/** Мітка категорії витрат за id (базові + користувацькі). */
export function resolveExpenseCategoryMeta(id, customCategories = []) {
  return resolveExpenseOverride(id, customCategories);
}

export function getIncomeCategory(desc = "", overrideId = null) {
  if (overrideId) {
    const found =
      INCOME_CATEGORIES.find((c) => c.id === overrideId) ||
      MCC_CATEGORIES.find((c) => c.id === overrideId);
    if (found) return found;
  }
  const d = desc.toLowerCase();
  for (const cat of INCOME_CATEGORIES) {
    if (cat.keywords.some((k) => d.includes(k))) return cat;
  }
  return INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1]; // in_other
}

export function getCategory(
  desc = "",
  mcc = 0,
  overrideId = null,
  customCategories = [],
) {
  if (overrideId) {
    const fromCustom = resolveExpenseOverride(overrideId, customCategories);
    if (fromCustom) return fromCustom;
    const found = MCC_CATEGORIES.find((c) => c.id === overrideId);
    if (found) return found;
  }
  for (const cat of MCC_CATEGORIES) {
    if (cat.mccs.includes(mcc)) return cat;
    if (cat.keywords.some((k) => desc.toLowerCase().includes(k))) return cat;
  }
  return { id: "other", label: "💳 Інше", mccs: [], keywords: [] };
}

export function fmtAmt(amount, cc = CURRENCY.UAH) {
  const v = amount / 100;
  const sym = cc === CURRENCY.UAH ? "₴" : cc === CURRENCY.USD ? "$" : "€";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("uk-UA", { minimumFractionDigits: 2 })}${sym}`;
}

export function fmtDate(ts) {
  const d = new Date(ts * 1000);
  const diff = Math.floor((Date.now() - d) / 86400000);
  const t = d.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (diff === 0) return `Сьогодні, ${t}`;
  if (diff === 1) return `Вчора, ${t}`;
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short" });
}

export function getAccountLabel(acc) {
  if (acc.type === "eAid") return "💳 Єпідтримка";
  if (acc.creditLimit > 0 && acc.type === "black") return "🖤 Кредитна картка";
  if (acc.creditLimit > 0) return "💳 Кредит";
  if (acc.type === "black") return "🖤 Чорна картка";
  if (acc.type === "white") return "⬜ Біла картка";
  if (acc.type === "platinum") return "💎 Платинова";
  if (acc.type === "iron") return "🔩 Залізна";
  if (acc.type === "fop") return "🏢 ФОП";
  return "💳 Картка";
}

export function getMonoDebt(acc) {
  if (acc.creditLimit > 0)
    return Math.max(0, (acc.creditLimit - acc.balance) / 100);
  if (acc.balance < 0) return Math.abs(acc.balance) / 100;
  return 0;
}

export function isMonoDebt(acc) {
  return acc.creditLimit > 0 && acc.creditLimit - acc.balance > 0;
}

export function daysUntil(day) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), day);
  if (target <= now) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target - now) / 86400000);
}

export function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Скільки сплачено по боргу (я винен):
// тільки від'ємні транзакції (витрати) = погашення боргу
export function getDebtPaid(debt, transactions) {
  return debtEngineGetDebtPaid(debt, transactions);
}

// Скільки повернено по дебіторці (мені винні):
// тільки позитивні транзакції (надходження) = погашення боргу
export function getRecvPaid(recv, transactions) {
  return getReceivablePaid(recv, transactions);
}

// Ефективна сума транзакції для статистики витрат (враховує спліт).
// Якщо є спліт — сумує лише частини що НЕ є внутрішнім переказом.
export function getTxStatAmount(tx, txSplits = {}) {
  const splits = txSplits[tx.id];
  if (!splits || splits.length === 0) return Math.abs(tx.amount / 100);
  return splits
    .filter((s) => s.categoryId !== INTERNAL_TRANSFER_ID)
    .reduce((s, p) => s + (p.amount || 0), 0);
}

// Сума витрат по категорії. txSplits дозволяє розбити одну транзакцію на декілька категорій.
export function calcCategorySpent(
  txs,
  categoryId,
  txCategories = {},
  txSplits = {},
  customCategories = [],
) {
  return Math.round(
    txs
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => {
        const splits = txSplits[t.id];
        if (splits && splits.length > 0) {
          return (
            sum +
            splits
              .filter((s) => s.categoryId === categoryId)
              .reduce((s, p) => s + (p.amount || 0), 0)
          );
        }
        if (
          getCategory(
            t.description,
            t.mcc,
            txCategories[t.id],
            customCategories,
          ).id === categoryId
        ) {
          return sum + Math.abs(t.amount / 100);
        }
        return sum;
      }, 0),
  );
}

// Підсумки по рахунках Mono
export function getMonoTotals(accounts, hiddenAccountIds = []) {
  const visible = accounts.filter((a) => !hiddenAccountIds.includes(a.id));
  const balance = visible
    .filter(
      (a) => a.balance > 0 && !a.creditLimit && a.currencyCode === CURRENCY.UAH,
    )
    .reduce((sum, a) => sum + a.balance / 100, 0);
  const debt = accounts
    .filter((a) => isMonoDebt(a))
    .reduce((sum, a) => sum + getMonoDebt(a), 0);
  return { balance, debt };
}
