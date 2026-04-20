import { normalizeFoodName } from "./pantryTextParser.js";
import { mergeItems } from "./mergeItems.js";
import type { PantryItem } from "./pantryTextParser.js";
import {
  macrosHasAnyValue,
  macrosToTotals,
  normalizeMacrosNullable,
  type Macros,
  type NullableMacros,
} from "./macros.js";
import { nutritionStorage } from "./nutritionStorageInstance.js";
import {
  isMealTypeId,
  labelForMealType,
  mealTypeFromLabel,
  type MealTypeId,
} from "./mealTypes.js";

export const NUTRITION_PANTRIES_KEY = "nutrition_pantries_v1";
export const NUTRITION_ACTIVE_PANTRY_KEY = "nutrition_active_pantry_v1";
export const NUTRITION_PREFS_KEY = "nutrition_prefs_v1";
export const NUTRITION_LOG_KEY = "nutrition_log_v1";

export type NutritionGoal = string;
export type MealMacroSource = "manual" | "productDb" | "photoAI" | "recipeAI";
export type MealSource = "manual" | "photo";

export interface MealTemplate {
  id: string;
  name: string;
  mealType: MealTypeId;
  macros: NullableMacros;
}

export interface NutritionPrefs {
  goal: NutritionGoal;
  servings: number;
  timeMinutes: number;
  exclude: string;
  dailyTargetKcal: number | null;
  dailyTargetProtein_g: number | null;
  dailyTargetFat_g: number | null;
  dailyTargetCarbs_g: number | null;
  mealTemplates: MealTemplate[];
  reminderEnabled: boolean;
  reminderHour: number;
  waterGoalMl: number;
}

export interface Pantry {
  id: string;
  name: string;
  items: PantryItem[];
  text: string;
}

export interface Meal {
  id: string;
  name: string;
  time: string;
  mealType: MealTypeId;
  label: string;
  macros: NullableMacros;
  source: MealSource;
  macroSource: MealMacroSource;
  amount_g: number | null;
  foodId: string | null;
  demo?: true;
}

export interface NutritionDay {
  meals: Meal[];
}

export type NutritionLog = Record<string, NutritionDay>;

export type NutritionLogLike =
  | Record<string, { meals?: unknown[] | null } | null | undefined>
  | null
  | undefined;

export interface DaySummary extends Macros {
  date: string;
  mealCount: number;
  hasMeals: boolean;
  hasAnyMacros: boolean;
}

export function toLocalISODate(d: Date | string | number = new Date()): string {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "1970-01-01";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function optionalPositiveNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function defaultNutritionPrefs(): NutritionPrefs {
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
    waterGoalMl: 2000,
  };
}

export function loadNutritionPrefs(
  key: string = NUTRITION_PREFS_KEY,
): NutritionPrefs {
  const p = nutritionStorage.readJSON(key, null) as unknown;
  if (!p || typeof p !== "object" || Array.isArray(p))
    return defaultNutritionPrefs();
  try {
    const defaults = defaultNutritionPrefs();
    const raw = p as Record<string, unknown>;
    const waterGoalMl = optionalPositiveNumber(raw.waterGoalMl);
    const mealTemplates: MealTemplate[] = Array.isArray(raw.mealTemplates)
      ? (raw.mealTemplates as unknown[])
          .filter(
            (t): t is Record<string, unknown> => !!t && typeof t === "object",
          )
          .map((t) => ({
            id: String(t.id || `tpl_${Date.now()}`),
            name: String(t.name || "").trim(),
            mealType: isMealTypeId(t.mealType) ? t.mealType : "snack",
            macros: normalizeMacros(t.macros),
          }))
          .filter((t) => t.name)
          .slice(0, 40)
      : [];
    return {
      ...defaults,
      ...(raw as Partial<NutritionPrefs>),
      servings: raw.servings != null ? Number(raw.servings) || 1 : 1,
      timeMinutes: raw.timeMinutes != null ? Number(raw.timeMinutes) || 25 : 25,
      exclude: raw.exclude == null ? "" : String(raw.exclude),
      goal: raw.goal ? String(raw.goal) : "balanced",
      dailyTargetKcal: optionalPositiveNumber(raw.dailyTargetKcal),
      dailyTargetProtein_g: optionalPositiveNumber(raw.dailyTargetProtein_g),
      dailyTargetFat_g: optionalPositiveNumber(raw.dailyTargetFat_g),
      dailyTargetCarbs_g: optionalPositiveNumber(raw.dailyTargetCarbs_g),
      mealTemplates,
      reminderEnabled: Boolean(raw.reminderEnabled),
      reminderHour:
        raw.reminderHour != null && Number.isFinite(Number(raw.reminderHour))
          ? Math.min(23, Math.max(0, Math.floor(Number(raw.reminderHour))))
          : 12,
      waterGoalMl: waterGoalMl != null ? waterGoalMl : defaults.waterGoalMl,
    };
  } catch {
    return defaultNutritionPrefs();
  }
}

export function persistNutritionPrefs(
  prefs: NutritionPrefs | null | undefined,
  key: string = NUTRITION_PREFS_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, prefs || defaultNutritionPrefs());
}

export function makeDefaultPantry(): Pantry {
  return { id: "home", name: "Дім", items: [], text: "" };
}

function sanitizePantryItem(raw: unknown): PantryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || "").trim();
  if (!name) return null;
  const qtyNum = Number(r.qty);
  const qty = r.qty == null || !Number.isFinite(qtyNum) ? null : qtyNum;
  return {
    name,
    qty,
    unit: r.unit == null ? null : String(r.unit),
    notes: r.notes == null ? null : String(r.notes),
  };
}

export function normalizePantries(raw: unknown): Pantry[] {
  if (!Array.isArray(raw)) return [];
  const out: Pantry[] = [];
  const seenIds = new Set<string>();
  for (const p of raw as unknown[]) {
    if (!p || typeof p !== "object") continue;
    const rp = p as Record<string, unknown>;
    let id = rp.id != null ? String(rp.id).trim() : "";
    if (!id || seenIds.has(id)) id = `p_${Date.now()}_${out.length}`;
    seenIds.add(id);
    const name = String(rp.name || "Склад").trim() || "Склад";
    const items = Array.isArray(rp.items)
      ? (rp.items as unknown[])
          .map(sanitizePantryItem)
          .filter((x): x is PantryItem => x != null)
      : [];
    const text = rp.text == null ? "" : String(rp.text);
    out.push({ id, name, items, text });
  }
  return out;
}

export function loadActivePantryId(
  activeKey: string = NUTRITION_ACTIVE_PANTRY_KEY,
): string {
  const v = nutritionStorage.readRaw(activeKey, null);
  return v ? String(v) : "home";
}

export function loadPantries(
  key: string = NUTRITION_PANTRIES_KEY,
  activeKey: string = NUTRITION_ACTIVE_PANTRY_KEY,
): Pantry[] {
  const parsed = nutritionStorage.readJSON(key, null);
  const normalized = normalizePantries(parsed);
  if (normalized.length > 0) return normalized;

  // Legacy v0 pantry migration is handled by storageManager (nutrition_001_migrate_legacy_pantry).
  // By the time this code runs after app boot, the v1 key already has data if any v0 data existed.
  const fallback = makeDefaultPantry();
  nutritionStorage.writeRaw(activeKey, fallback.id);
  return [fallback];
}

export function persistPantries(
  key: string = NUTRITION_PANTRIES_KEY,
  activeKey: string = NUTRITION_ACTIVE_PANTRY_KEY,
  pantries?: Pantry[] | null,
  activeId?: string | null,
): boolean {
  const a = nutritionStorage.writeJSON(
    key,
    Array.isArray(pantries) ? pantries : [],
  );
  const b = activeId
    ? nutritionStorage.writeRaw(activeKey, String(activeId))
    : true;
  return a && b;
}

export function updatePantry(
  pantries: Pantry[] | null | undefined,
  activeId: string | null | undefined,
  fn: (p: Pantry) => Pantry,
): Pantry[] {
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

export function upsertPantryItem(pantry: Pantry, name: string): Pantry {
  const n = normalizeFoodName(name);
  if (!n) return pantry;
  const arr = Array.isArray(pantry?.items) ? pantry.items : [];
  if (arr.some((x) => normalizeFoodName(x?.name) === n)) return pantry;
  return {
    ...pantry,
    items: [...arr, { name: n, qty: null, unit: null, notes: null }],
  };
}

export function removePantryItem(pantry: Pantry, name: string): Pantry {
  const n = normalizeFoodName(name);
  if (!n) return pantry;
  const arr = Array.isArray(pantry?.items) ? pantry.items : [];
  return {
    ...pantry,
    items: arr.filter((x) => normalizeFoodName(x?.name) !== n),
  };
}

export function mergePantryItems(
  pantry: Pantry,
  incomingItems: unknown,
): Pantry {
  return { ...pantry, items: mergeItems(pantry?.items, incomingItems) };
}

function normalizeMacros(mac: unknown): NullableMacros {
  // Backward-compatible export name used across this module:
  // meals/templates store nullable macros; totals are computed separately.
  return normalizeMacrosNullable(mac);
}

export function normalizeMeal(m: unknown, idx: number): Meal {
  const raw = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
  let id = raw.id != null && String(raw.id).trim() ? String(raw.id).trim() : "";
  if (!id)
    id = `meal_mig_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

  const name = raw.name != null ? String(raw.name).trim() : "";
  const time = raw.time != null ? String(raw.time).trim() : "";

  let mealType: MealTypeId;
  if (isMealTypeId(raw.mealType)) {
    mealType = raw.mealType;
  } else {
    mealType = mealTypeFromLabel(raw.label);
  }

  const label =
    raw.label != null && String(raw.label).trim()
      ? String(raw.label).trim()
      : labelForMealType(mealType);

  const macros = normalizeMacros(raw.macros);
  const source: MealSource =
    raw.source && String(raw.source) === "photo" ? "photo" : "manual";

  const rawMacroSource =
    raw.macroSource != null ? String(raw.macroSource).trim() : "";
  const macroSource: MealMacroSource =
    rawMacroSource === "manual" ||
    rawMacroSource === "productDb" ||
    rawMacroSource === "photoAI" ||
    rawMacroSource === "recipeAI"
      ? (rawMacroSource as MealMacroSource)
      : source === "photo"
        ? "photoAI"
        : "manual";

  const amount_g =
    raw.amount_g != null &&
    Number.isFinite(Number(raw.amount_g)) &&
    Number(raw.amount_g) > 0
      ? Number(raw.amount_g)
      : null;
  const foodId =
    raw.foodId != null && String(raw.foodId).trim()
      ? String(raw.foodId).trim()
      : null;

  // Pass the FTUX demo flag through untouched. Seeded meals carry
  // `demo: true` so cross-module detectors (see `firstRealEntry.js`) can
  // tell seeded data apart from real entries. Because `useNutritionLog`
  // immediately persists the normalized log back to localStorage, any
  // property dropped here is lost on the first module visit — which is
  // what used to silently re-classify demo meals as real entries and
  // trip the soft-auth prompt.
  const out: Meal = {
    id,
    name,
    time,
    mealType,
    label,
    macros,
    source,
    macroSource,
    amount_g,
    foodId,
  };
  if (raw.demo === true) out.demo = true;
  return out;
}

export function normalizeNutritionLog(raw: unknown): NutritionLog {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NutritionLog = {};
  for (const [dateKey, day] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const mealsRaw = (day as { meals?: unknown } | null)?.meals;
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

export function loadNutritionLog(
  key: string = NUTRITION_LOG_KEY,
): NutritionLog {
  const parsed = nutritionStorage.readJSON(key, null);
  return normalizeNutritionLog(parsed);
}

export function persistNutritionLog(
  log: NutritionLog | null | undefined,
  key: string = NUTRITION_LOG_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, log || {});
}

export function addLogEntry(
  log: NutritionLog,
  date: string,
  meal: unknown,
): NutritionLog {
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

export function removeLogEntry(
  log: NutritionLog,
  date: string,
  id: string,
): NutritionLog {
  const day = log[date];
  if (!day) return log;
  const meals = (Array.isArray(day.meals) ? day.meals : []).filter(
    (m) => m.id !== id,
  );
  if (meals.length === 0) {
    const next: NutritionLog = { ...log };
    delete next[date];
    return next;
  }
  return { ...log, [date]: { ...day, meals } };
}

export function updateLogEntry(
  log: NutritionLog,
  date: string,
  meal: unknown,
): NutritionLog {
  const normalized = normalizeMeal(meal, 0);
  const day = log[date];
  if (!day) return log;
  const prevMeals = Array.isArray(day.meals) ? day.meals : [];
  const idx = prevMeals.findIndex((m) => m.id === normalized.id);
  if (idx === -1) return log;
  const nextMeals = [...prevMeals];
  nextMeals[idx] = normalized;
  return { ...log, [date]: { ...day, meals: nextMeals } };
}

export function getDayMacros(log: NutritionLogLike, date: string): Macros {
  const day = log?.[date];
  if (!day || !Array.isArray(day.meals))
    return { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
  return (day.meals as Meal[]).reduce<Macros>(
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

export function getDaySummary(log: NutritionLogLike, date: string): DaySummary {
  const day = log?.[date];
  const meals = (Array.isArray(day?.meals) ? day.meals : []) as Meal[];
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

export function addDaysISODate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return toLocalISODate(dt);
}

export function duplicatePreviousDayMeals(
  log: NutritionLog,
  targetDate: string,
): NutritionLog {
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

export function mergeNutritionLogs(
  base: unknown,
  incoming: unknown,
): NutritionLog {
  const a = normalizeNutritionLog(base);
  const b = normalizeNutritionLog(incoming);
  const out: NutritionLog = { ...a };
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

export interface MealSearchResult {
  date: string;
  meal: Meal;
}

export function searchMealsByName(
  log: NutritionLogLike,
  query: string,
): MealSearchResult[] {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return [];
  const results: MealSearchResult[] = [];
  for (const [date, day] of Object.entries(log || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const m of (day?.meals || []) as Meal[]) {
      const n = String(m?.name || "").toLowerCase();
      if (n.includes(q)) results.push({ date, meal: m });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

export interface MacrosRow extends Macros {
  date: string;
}

export function getMacrosForDateRange(
  log: NutritionLogLike,
  endIso: string,
  dayCount: number,
): MacrosRow[] {
  const rows: MacrosRow[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = addDaysISODate(endIso, -i);
    rows.push({ date: d, ...getDayMacros(log, d) });
  }
  return rows;
}

export function estimateLogBytes(log: NutritionLogLike): number {
  try {
    return new Blob([JSON.stringify(log || {})]).size;
  } catch {
    return 0;
  }
}

/** Залишає лише останні `keepCount` календарних днів (за сортуванням дат). */
export function trimLogOldestDays(
  log: unknown,
  keepCount: number,
): NutritionLog {
  const normalized = normalizeNutritionLog(log);
  const dates = Object.keys(normalized)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
  if (dates.length <= keepCount) return normalized;
  const drop = dates.slice(0, dates.length - keepCount);
  const out: NutritionLog = { ...normalized };
  for (const d of drop) delete out[d];
  return out;
}
