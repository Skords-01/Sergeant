import { safeReadLS } from "@shared/lib/storage.js";
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

/**
 * Розраховує скільки потрібно відкладати щомісяця для досягнення цілі.
 * @returns {{ monthlyNeeded: number|null, monthsLeft: number, isAchieved: boolean, isOverdue: boolean }}
 */
export function calcMonthlyNeeded(targetAmount, savedAmount, targetDate) {
  const tgt = Number(targetAmount) || 0;
  const saved = Number(savedAmount) || 0;

  if (saved >= tgt && tgt > 0) {
    return {
      monthlyNeeded: null,
      monthsLeft: 0,
      isAchieved: true,
      isOverdue: false,
    };
  }

  if (!targetDate) {
    return {
      monthlyNeeded: null,
      monthsLeft: null,
      isAchieved: false,
      isOverdue: false,
    };
  }

  const now = new Date();
  const y1 = now.getUTCFullYear();
  const m1 = now.getUTCMonth();
  const d1 = now.getUTCDate();

  const target = (() => {
    const s = String(targetDate || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0));
    }
    const dt = new Date(targetDate);
    return new Date(
      Date.UTC(
        dt.getUTCFullYear(),
        dt.getUTCMonth(),
        dt.getUTCDate(),
        12,
        0,
        0,
        0,
      ),
    );
  })();

  const nowMiddayUtc = new Date(Date.UTC(y1, m1, d1, 12, 0, 0, 0));
  if (target <= nowMiddayUtc) {
    return {
      monthlyNeeded: null,
      monthsLeft: 0,
      isAchieved: false,
      isOverdue: true,
    };
  }

  const y2 = target.getUTCFullYear(),
    m2 = target.getUTCMonth();
  let monthsLeft = (y2 - y1) * 12 + (m2 - m1);
  const sameMonthsLater = new Date(
    Date.UTC(y1, m1 + monthsLeft, d1, 12, 0, 0, 0),
  );
  if (target > sameMonthsLater) monthsLeft += 1;
  monthsLeft = Math.max(1, monthsLeft);
  const remaining = Math.max(0, tgt - saved);
  const monthlyNeeded = Math.ceil(remaining / monthsLeft);

  return { monthlyNeeded, monthsLeft, isAchieved: false, isOverdue: false };
}

// Збирає Set ID транзакцій, що виключаються зі статистики ФІНІК (та сама логіка, що
// в `useStorage` → `excludedTxIds`), читаючи безпосередньо з localStorage.
// Це дозволяє іншим сторінкам (Звіти, AI Digest) використовувати ту саму логіку
// без mounted-хука useStorage.
export function getFinykExcludedTxIdsFromStorage() {
  const hidden = safeReadLS("finyk_hidden_txs", []);
  const txCats = safeReadLS("finyk_tx_cats", {});
  const recv = safeReadLS("finyk_recv", []);
  const extra = safeReadLS("finyk_excluded_stat_txs", []);
  const transferIds = Object.entries(
    txCats && typeof txCats === "object" ? txCats : {},
  )
    .filter(([, v]) => v === INTERNAL_TRANSFER_ID)
    .map(([k]) => k);
  const recvIds = Array.isArray(recv)
    ? recv.flatMap((r) => (Array.isArray(r?.linkedTxIds) ? r.linkedTxIds : []))
    : [];
  return new Set([
    ...(Array.isArray(hidden) ? hidden : []),
    ...transferIds,
    ...recvIds,
    ...(Array.isArray(extra) ? extra : []),
  ]);
}

export function getFinykTxSplitsFromStorage() {
  const v = safeReadLS("finyk_tx_splits", {});
  return v && typeof v === "object" ? v : {};
}

/**
 * Сумарні витрати ФІНІК за списком транзакцій, з урахуванням excludedTxIds та
 * txSplits (через getTxStatAmount). Ця функція — єдине джерело правди для
 * підрахунку spent у Overview, Звітах та інших місцях. Повертає float — округлення
 * виконується викликачем при виводі.
 */
export function calcFinykSpendingTotal(
  transactions,
  { excludedTxIds, txSplits = {} } = {},
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set
      ? excludedTxIds
      : new Set(Array.isArray(excludedTxIds) ? excludedTxIds : []);
  let total = 0;
  for (const tx of list) {
    if (!tx || excluded.has(tx.id)) continue;
    if (!(tx.amount < 0)) continue;
    const amt = getTxStatAmount(tx, txSplits);
    if (Number.isFinite(amt) && amt > 0) total += amt;
  }
  return total;
}

/**
 * Підсумовує витрати ФІНІК у заданому діапазоні дат за тими ж правилами, що й
 * Overview. Повертає {total, daily}, причому total = сума округлених daily —
 * це гарантує, що сума стовпчиків на графіку дорівнює числу в картці.
 */
export function calcFinykSpendingByDate(
  transactions,
  { excludedTxIds, txSplits = {}, dateSet, localDateKeyFn },
) {
  const daily = {};
  const list = Array.isArray(transactions) ? transactions : [];
  const excluded =
    excludedTxIds instanceof Set
      ? excludedTxIds
      : new Set(Array.isArray(excludedTxIds) ? excludedTxIds : []);

  for (const tx of list) {
    if (!tx || excluded.has(tx.id)) continue;
    if (!(tx.amount < 0)) continue;
    const ts = tx.time > 1e10 ? tx.time : tx.time * 1000;
    const dk = localDateKeyFn(new Date(ts));
    if (!dateSet.has(dk)) continue;
    const amt = getTxStatAmount(tx, txSplits);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    daily[dk] = (daily[dk] || 0) + amt;
  }

  const dailyRounded = {};
  let total = 0;
  for (const k of Object.keys(daily)) {
    const r = Math.round(daily[k]);
    dailyRounded[k] = r;
    total += r;
  }
  return { total, daily: dailyRounded };
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
