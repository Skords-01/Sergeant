import { normalizeFoodName } from "./pantryTextParser.js";
import { mergeItems } from "./mergeItems.js";
import {
  macrosHasAnyValue,
  macrosToTotals,
  normalizeMacrosNullable,
} from "./macros.js";
import {
  isMealTypeId,
  labelForMealType,
  mealTypeFromLabel,
} from "./mealTypes.js";

export const NUTRITION_PANTRIES_KEY = "nutrition_pantries_v1";
export const NUTRITION_ACTIVE_PANTRY_KEY = "nutrition_active_pantry_v1";
export const NUTRITION_PREFS_KEY = "nutrition_prefs_v1";
export const NUTRITION_LOG_KEY = "nutrition_log_v1";

const LEGACY_ITEMS_KEY = "nutrition_pantry_items_v0";
const LEGACY_TEXT_KEY = "nutrition_pantry_text_v0";

export function toLocalISODate(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "1970-01-01";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function optionalPositiveNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function defaultNutritionPrefs() {
  return {
    goal: "balanced",
    servings: 1,
    timeMinutes: 25,
    exclude: "",
    dailyTargetKcal: null,
    dailyTargetProtein_g: null,
    dailyTargetFat_g: null,
    dailyTargetCarbs_g: null,
    mealTemplates: [],
    reminderEnabled: false,
    reminderHour: 12,
  };
}

export function loadNutritionPrefs(key = NUTRITION_PREFS_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultNutritionPrefs();
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || Array.isArray(p))
      return defaultNutritionPrefs();
    return {
      ...defaultNutritionPrefs(),
      ...p,
      servings: p.servings != null ? Number(p.servings) || 1 : 1,
      timeMinutes: p.timeMinutes != null ? Number(p.timeMinutes) || 25 : 25,
      exclude: p.exclude == null ? "" : String(p.exclude),
      goal: p.goal ? String(p.goal) : "balanced",
      dailyTargetKcal: optionalPositiveNumber(p.dailyTargetKcal),
      dailyTargetProtein_g: optionalPositiveNumber(p.dailyTargetProtein_g),
      dailyTargetFat_g: optionalPositiveNumber(p.dailyTargetFat_g),
      dailyTargetCarbs_g: optionalPositiveNumber(p.dailyTargetCarbs_g),
      mealTemplates: Array.isArray(p.mealTemplates)
        ? p.mealTemplates
            .filter((t) => t && typeof t === "object")
            .map((t) => ({
              id: String(t.id || `tpl_${Date.now()}`),
              name: String(t.name || "").trim(),
              mealType: isMealTypeId(t.mealType) ? t.mealType : "snack",
              macros: normalizeMacros(t.macros),
            }))
            .filter((t) => t.name)
            .slice(0, 40)
        : [],
      reminderEnabled: Boolean(p.reminderEnabled),
      reminderHour:
        p.reminderHour != null && Number.isFinite(Number(p.reminderHour))
          ? Math.min(23, Math.max(0, Math.floor(Number(p.reminderHour))))
          : 12,
    };
  } catch {
    return defaultNutritionPrefs();
  }
}

export function persistNutritionPrefs(prefs, key = NUTRITION_PREFS_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs || defaultNutritionPrefs()));
    return true;
  } catch {
    return false;
  }
}

export function makeDefaultPantry() {
  return { id: "home", name: "Дім", items: [], text: "" };
}

export function loadActivePantryId(activeKey = NUTRITION_ACTIVE_PANTRY_KEY) {
  try {
    const v = localStorage.getItem(activeKey);
    return v ? String(v) : "home";
  } catch {
    return "home";
  }
}

export function loadPantries(
  key = NUTRITION_PANTRIES_KEY,
  activeKey = NUTRITION_ACTIVE_PANTRY_KEY,
) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Міграція: якщо є старі ключі (не було складів), підтягнемо як "Дім"
  let fallback = makeDefaultPantry();
  try {
    const oldItems = JSON.parse(
      localStorage.getItem(LEGACY_ITEMS_KEY) || "null",
    );
    const oldText = String(localStorage.getItem(LEGACY_TEXT_KEY) || "");
    if (Array.isArray(oldItems) && oldItems.length > 0)
      fallback.items = oldItems;
    if (oldText) fallback.text = oldText;
  } catch {}
  try {
    localStorage.setItem(activeKey, fallback.id);
  } catch {}
  return [fallback];
}

export function persistPantries(
  key = NUTRITION_PANTRIES_KEY,
  activeKey = NUTRITION_ACTIVE_PANTRY_KEY,
  pantries,
  activeId,
) {
  let ok = true;
  try {
    localStorage.setItem(
      key,
      JSON.stringify(Array.isArray(pantries) ? pantries : []),
    );
  } catch {
    ok = false;
  }
  try {
    if (activeId) localStorage.setItem(activeKey, String(activeId));
  } catch {
    ok = false;
  }
  return ok;
}

export function updatePantry(pantries, activeId, fn) {
  const arr = Array.isArray(pantries) ? pantries : [];
  const id = String(activeId || "home");
  const idx = arr.findIndex((p) => p.id === id);
  if (idx === -1) {
    const created = fn(makeDefaultPantry());
    return [created, ...arr];
  }
  const next = [...arr];
  next[idx] = fn(next[idx]);
  return next;
}

export function upsertPantryItem(pantry, name) {
  const n = normalizeFoodName(name);
  if (!n) return pantry;
  const arr = Array.isArray(pantry?.items) ? pantry.items : [];
  if (arr.some((x) => normalizeFoodName(x?.name) === n)) return pantry;
  return {
    ...pantry,
    items: [...arr, { name: n, qty: null, unit: null, notes: null }],
  };
}

export function removePantryItem(pantry, name) {
  const n = normalizeFoodName(name);
  if (!n) return pantry;
  const arr = Array.isArray(pantry?.items) ? pantry.items : [];
  return {
    ...pantry,
    items: arr.filter((x) => normalizeFoodName(x?.name) !== n),
  };
}

export function mergePantryItems(pantry, incomingItems) {
  return { ...pantry, items: mergeItems(pantry?.items, incomingItems) };
}

function normalizeMacros(mac) {
  // Backward-compatible export name used across this module:
  // meals/templates store nullable macros; totals are computed separately.
  return normalizeMacrosNullable(mac);
}

export function normalizeMeal(m, idx) {
  const raw = m && typeof m === "object" ? m : {};
  let id = raw.id != null && String(raw.id).trim() ? String(raw.id).trim() : "";
  if (!id)
    id = `meal_mig_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

  const name = raw.name != null ? String(raw.name).trim() : "";
  const time = raw.time != null ? String(raw.time).trim() : "";

  let mealType = raw.mealType;
  if (!isMealTypeId(mealType)) {
    mealType = mealTypeFromLabel(raw.label);
  }

  const label =
    raw.label != null && String(raw.label).trim()
      ? String(raw.label).trim()
      : labelForMealType(mealType);

  const macros = normalizeMacros(raw.macros);
  const source =
    raw.source && String(raw.source) === "photo" ? "photo" : "manual";

  const rawMacroSource =
    raw.macroSource != null ? String(raw.macroSource).trim() : "";
  const macroSource =
    rawMacroSource === "manual" ||
    rawMacroSource === "productDb" ||
    rawMacroSource === "photoAI" ||
    rawMacroSource === "recipeAI"
      ? rawMacroSource
      : source === "photo"
        ? "photoAI"
        : "manual";

  return { id, name, time, mealType, label, macros, source, macroSource };
}

export function normalizeNutritionLog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [dateKey, day] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const mealsRaw = day?.meals;
    if (!Array.isArray(mealsRaw)) {
      out[dateKey] = { meals: [] };
      continue;
    }
    out[dateKey] = {
      meals: mealsRaw.map((m, i) => normalizeMeal(m, i)),
    };
  }
  return out;
}

// ─────────────────────────────────────────────
// Nutrition log (журнал прийомів їжі)
// ─────────────────────────────────────────────

export function loadNutritionLog(key = NUTRITION_LOG_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return normalizeNutritionLog(parsed);
  } catch {
    return {};
  }
}

export function persistNutritionLog(log, key = NUTRITION_LOG_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(log || {}));
    return true;
  } catch {
    return false;
  }
}

export function addLogEntry(log, date, meal) {
  const normalized = normalizeMeal(meal, 0);
  const day = log[date] || { meals: [] };
  return {
    ...log,
    [date]: {
      ...day,
      meals: [...(Array.isArray(day.meals) ? day.meals : []), normalized],
    },
  };
}

export function removeLogEntry(log, date, id) {
  const day = log[date];
  if (!day) return log;
  const meals = (Array.isArray(day.meals) ? day.meals : []).filter(
    (m) => m.id !== id,
  );
  if (meals.length === 0) {
    const next = { ...log };
    delete next[date];
    return next;
  }
  return { ...log, [date]: { ...day, meals } };
}

export function getDayMacros(log, date) {
  const day = log[date];
  if (!day || !Array.isArray(day.meals))
    return { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
  return day.meals.reduce(
    (acc, m) => {
      const mac = macrosToTotals(m?.macros);
      return {
        kcal: acc.kcal + mac.kcal,
        protein_g: acc.protein_g + mac.protein_g,
        fat_g: acc.fat_g + mac.fat_g,
        carbs_g: acc.carbs_g + mac.carbs_g,
      };
    },
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );
}

export function getDaySummary(log, date) {
  const day = log?.[date];
  const meals = Array.isArray(day?.meals) ? day.meals : [];
  const totals = getDayMacros(log, date);
  const hasAnyMacros = meals.some((m) => macrosHasAnyValue(m?.macros));
  return {
    date,
    mealCount: meals.length,
    hasMeals: meals.length > 0,
    hasAnyMacros,
    ...totals,
  };
}

export function addDaysISODate(iso, deltaDays) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return toLocalISODate(dt);
}

export function duplicatePreviousDayMeals(log, targetDate) {
  const prev = addDaysISODate(targetDate, -1);
  const prevDay = log[prev];
  if (!prevDay || !Array.isArray(prevDay.meals) || prevDay.meals.length === 0)
    return log;
  const existing = Array.isArray(log[targetDate]?.meals)
    ? log[targetDate].meals
    : [];
  const startIdx = existing.length;
  const clones = prevDay.meals.map((m, i) =>
    normalizeMeal({ ...m, id: undefined, source: "manual" }, startIdx + i),
  );
  return {
    ...log,
    [targetDate]: { meals: [...existing, ...clones] },
  };
}

export function mergeNutritionLogs(base, incoming) {
  const a = normalizeNutritionLog(base);
  const b = normalizeNutritionLog(incoming);
  const out = { ...a };
  for (const [d, dayB] of Object.entries(b)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const mealsB = Array.isArray(dayB?.meals) ? dayB.meals : [];
    if (mealsB.length === 0) continue;
    const existing = Array.isArray(out[d]?.meals) ? out[d].meals : [];
    const merged = [
      ...existing,
      ...mealsB.map((m, i) => normalizeMeal(m, existing.length + i)),
    ];
    out[d] = { meals: merged };
  }
  return out;
}

export function searchMealsByName(log, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return [];
  const results = [];
  for (const [date, day] of Object.entries(log)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const m of day?.meals || []) {
      const n = String(m?.name || "").toLowerCase();
      if (n.includes(q)) results.push({ date, meal: m });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

export function getMacrosForDateRange(log, endIso, dayCount) {
  const rows = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = addDaysISODate(endIso, -i);
    rows.push({ date: d, ...getDayMacros(log, d) });
  }
  return rows;
}

export function estimateLogBytes(log) {
  try {
    return new Blob([JSON.stringify(log || {})]).size;
  } catch {
    return 0;
  }
}

/** Залишає лише останні `keepCount` календарних днів (за сортуванням дат). */
export function trimLogOldestDays(log, keepCount) {
  const normalized = normalizeNutritionLog(log);
  const dates = Object.keys(normalized)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
  if (dates.length <= keepCount) return normalized;
  const drop = dates.slice(0, dates.length - keepCount);
  const out = { ...normalized };
  for (const d of drop) delete out[d];
  return out;
}
