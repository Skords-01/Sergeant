/**
 * Підрахунок щоденного зведення по Фініку (витрати за сьогодні + топ-категорія)
 * та легкі "sticky" сигнали для Hub-дашборду.
 *
 * Чиста функція: приймає `now` та `readLS` (за замовчуванням — localStorage),
 * не має побічних ефектів, легко тестується без дата-mocking.
 *
 * Дизайн-принципи нагадувань (м'які, не токсичні, без гейміфікації):
 * - ніколи не показуємо reminder новим користувачам (без історії витрат)
 * - reminder про "активний день без записів" з'являється лише якщо в інших
 *   модулях (routine/fizruk/nutrition) вже є активність сьогодні — тобто
 *   користувач явно в застосунку, але витрати забув
 * - reminder "не додано витрат сьогодні" активується лише з вечора (>=18:00)
 *   і лише якщо у користувача є регулярність (витрати принаймні у 3 з
 *   останніх 7 днів) — щоб не набридати нерегулярним користувачам
 * - усі нагадування dismissible на один день
 */

import { MCC_CATEGORIES, INCOME_CATEGORIES } from "@finyk/constants.js";

const ALL_CATS = [...MCC_CATEGORIES, ...INCOME_CATEGORIES];

const BUILTIN_LABELS = {
  food: "🛒 Продукти",
  cafe: "🍽️ Кафе та ресторани",
  transport: "🚗 Транспорт",
  entertainment: "🎭 Розваги",
  health: "⚕️ Здоров'я",
  shopping: "🛍️ Покупки",
  utilities: "💡 Комунальні",
  other: "💳 Інше",
};

export const DAILY_SUMMARY_DISMISS_KEY = "hub_daily_finyk_dismissed_v1";

function defaultReadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveCatLabel(catIdOrMcc, customCategories) {
  if (!catIdOrMcc || catIdOrMcc === "other") return BUILTIN_LABELS.other;
  const str = String(catIdOrMcc);
  const byId = [...ALL_CATS, ...(customCategories || [])].find(
    (c) => c.id === str,
  );
  if (byId) return byId.label ?? byId.name ?? str;
  if (BUILTIN_LABELS[str]) return BUILTIN_LABELS[str];
  const mcc = Number(str);
  if (Number.isFinite(mcc) && mcc > 0) {
    const byMcc = MCC_CATEGORIES.find(
      (c) => Array.isArray(c.mccs) && c.mccs.includes(mcc),
    );
    if (byMcc) return byMcc.label;
  }
  return str;
}

function txTimestampMs(tx) {
  const t = Number(tx?.time);
  if (!Number.isFinite(t)) return NaN;
  return t > 1e10 ? t : t * 1000;
}

function toDayKeyFromTs(ts) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return null;
  return localDateKey(d);
}

/**
 * Повертає набір ключів днів (YYYY-MM-DD), в які користувач додавав витрати
 * протягом останніх `days` днів (не враховуючи сьогодні).
 */
function collectExpenseDaysWithin(
  { bankTxs, manualExpenses, hiddenIds, transferIds },
  todayKey,
  days,
) {
  const keys = new Set();
  const now = Date.now();
  const minMs = now - days * 86_400_000;

  for (const tx of bankTxs) {
    if (!tx || (tx.amount ?? 0) >= 0) continue;
    if (hiddenIds.has(tx.id) || transferIds.has(tx.id)) continue;
    const ms = txTimestampMs(tx);
    if (!Number.isFinite(ms) || ms < minMs) continue;
    const key = toDayKeyFromTs(ms);
    if (key && key !== todayKey) keys.add(key);
  }

  for (const me of manualExpenses) {
    const d = me?.date ? new Date(`${me.date}T00:00:00`) : null;
    if (!d || !Number.isFinite(d.getTime())) continue;
    if (d.getTime() < minMs) continue;
    const key = localDateKey(d);
    if (key !== todayKey) keys.add(key);
  }

  return keys;
}

function isActivityTodayFromModules(now, readLS) {
  const todayKey = localDateKey(now);

  // Routine: будь-яка звичка позначена сьогодні
  const routine = readLS("hub_routine_v1", null);
  if (routine && Array.isArray(routine.habits) && routine.completions) {
    for (const h of routine.habits) {
      if (h?.archived) continue;
      const arr = routine.completions[h.id];
      if (Array.isArray(arr) && arr.includes(todayKey)) return true;
    }
  }

  // Fizruk: тренування, що почалось сьогодні
  const workoutsRaw = readLS("fizruk_workouts_v1", null);
  const workouts = Array.isArray(workoutsRaw)
    ? workoutsRaw
    : Array.isArray(workoutsRaw?.workouts)
      ? workoutsRaw.workouts
      : [];
  for (const w of workouts) {
    if (!w?.startedAt) continue;
    const ts = new Date(w.startedAt);
    if (!Number.isFinite(ts.getTime())) continue;
    if (localDateKey(ts) === todayKey) return true;
  }

  // Nutrition: щонайменше один прийом їжі сьогодні
  const log = readLS("nutrition_log_v1", null);
  const meals = log?.[todayKey]?.meals;
  if (Array.isArray(meals) && meals.length > 0) return true;

  return false;
}

/**
 * Основна функція. Повертає опис того, що показати на дашборді.
 *
 * Можливі значення `status`:
 * - `hidden`       — картку взагалі не показуємо (новий користувач без історії)
 * - `has_expenses` — є витрати сьогодні, показуємо суму + топ-категорію
 * - `quiet`        — витрат сьогодні нема, користувач нерегулярний, показуємо
 *                    просто neutral-стан ("Сьогодні витрат ще не було")
 * - `reminder_no_expenses` — м'яке нагадування: увечері, користувач регулярний
 * - `reminder_active_day`  — є активність в інших модулях, але фіністс пустий
 */
export function computeDailyFinykSummary({
  now = new Date(),
  readLS = defaultReadLS,
} = {}) {
  const todayKey = localDateKey(now);
  const hour = now.getHours();

  const txCache = readLS("finyk_tx_cache", null);
  const bankTxs = Array.isArray(txCache?.txs)
    ? txCache.txs
    : Array.isArray(txCache)
      ? txCache
      : [];
  const manualExpenses = (() => {
    const v = readLS("finyk_manual_expenses_v1", []);
    return Array.isArray(v) ? v : [];
  })();
  const txCategories = readLS("finyk_tx_cats", {}) || {};
  const txSplitsRaw = readLS("finyk_tx_splits", {}) || {};
  const txSplits =
    txSplitsRaw && typeof txSplitsRaw === "object" ? txSplitsRaw : {};
  const hiddenIds = new Set(readLS("finyk_hidden_txs", []) || []);
  const customCategories = readLS("finyk_custom_cats_v1", []) || [];
  const transferIds = new Set(
    Object.entries(txCategories)
      .filter(([, v]) => v === "internal_transfer")
      .map(([k]) => k),
  );

  // ── Агрегація сьогоднішніх витрат ────────────────────────────────────────
  let todaySpent = 0;
  let txCount = 0;
  const catAmounts = {};

  for (const tx of bankTxs) {
    if (!tx || (tx.amount ?? 0) >= 0) continue;
    if (hiddenIds.has(tx.id) || transferIds.has(tx.id)) continue;
    const ms = txTimestampMs(tx);
    if (!Number.isFinite(ms)) continue;
    if (localDateKey(new Date(ms)) !== todayKey) continue;

    const splits = Array.isArray(txSplits[tx.id]) ? txSplits[tx.id] : null;
    if (splits && splits.length > 0) {
      for (const s of splits) {
        if (!s || !s.categoryId || s.categoryId === "internal_transfer") {
          continue;
        }
        const amt = Math.abs(Number(s.amount) || 0);
        if (amt <= 0) continue;
        todaySpent += amt;
        catAmounts[s.categoryId] = (catAmounts[s.categoryId] || 0) + amt;
      }
      txCount++;
    } else {
      const amt = Math.abs(tx.amount / 100);
      todaySpent += amt;
      const catId = txCategories[tx.id] || tx.mcc || "other";
      const key = String(catId);
      catAmounts[key] = (catAmounts[key] || 0) + amt;
      txCount++;
    }
  }

  for (const me of manualExpenses) {
    if (!me || !me.date || me.date !== todayKey) continue;
    const amt = Math.abs(Number(me.amount) || 0);
    if (amt <= 0) continue;
    todaySpent += amt;
    const key = String(me.category || "other");
    catAmounts[key] = (catAmounts[key] || 0) + amt;
    txCount++;
  }

  // ── Топ-категорія ────────────────────────────────────────────────────────
  let topCategory = null;
  const catEntries = Object.entries(catAmounts).sort(([, a], [, b]) => b - a);
  if (catEntries.length > 0 && todaySpent > 0) {
    const [catId, amount] = catEntries[0];
    const roundedAmount = Math.round(amount);
    const pct = todaySpent > 0 ? Math.round((amount / todaySpent) * 100) : 0;
    topCategory = {
      id: catId,
      label: resolveCatLabel(catId, customCategories),
      amount: roundedAmount,
      pct,
    };
  }

  // ── Історія (для прийняття рішення про reminder) ─────────────────────────
  const recentDays = collectExpenseDaysWithin(
    { bankTxs, manualExpenses, hiddenIds, transferIds },
    todayKey,
    7,
  );
  const hasAnyHistory =
    bankTxs.some((t) => (t?.amount ?? 0) < 0) || manualExpenses.length > 0;

  if (todaySpent > 0 && topCategory) {
    return {
      status: "has_expenses",
      todayKey,
      todaySpent: Math.round(todaySpent),
      txCount,
      topCategory,
    };
  }

  // Немає витрат сьогодні — вирішуємо, який meaningful state показати.
  if (!hasAnyHistory) {
    return { status: "hidden", todayKey, todaySpent: 0, txCount: 0 };
  }

  const activeToday = isActivityTodayFromModules(now, readLS);
  const isRegular = recentDays.size >= 3;
  const isEvening = hour >= 18;

  if (activeToday) {
    return {
      status: "reminder_active_day",
      todayKey,
      todaySpent: 0,
      txCount: 0,
    };
  }

  if (isRegular && isEvening) {
    return {
      status: "reminder_no_expenses",
      todayKey,
      todaySpent: 0,
      txCount: 0,
    };
  }

  return {
    status: "quiet",
    todayKey,
    todaySpent: 0,
    txCount: 0,
  };
}

export function isDailySummaryDismissedToday({
  now = new Date(),
  readLS = defaultReadLS,
} = {}) {
  const todayKey = localDateKey(now);
  const v = readLS(DAILY_SUMMARY_DISMISS_KEY, null);
  return Boolean(v && v.date === todayKey);
}
