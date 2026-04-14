import {
  NUTRITION_ACTIVE_PANTRY_KEY,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_PREFS_KEY,
  NUTRITION_LOG_KEY,
  defaultNutritionPrefs,
  loadNutritionPrefs,
  loadNutritionLog,
  normalizeNutritionLog,
} from "../lib/nutritionStorage.js";

export const NUTRITION_BACKUP_KIND = "hub-nutrition-backup";
export const NUTRITION_BACKUP_SCHEMA_VERSION = 1;

function readJsonFromLocalStorage(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const s = localStorage.getItem(key);
    if (s === null) return fallback;
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function safeString(x, fallback = "") {
  return x == null ? fallback : String(x);
}

function safeNumber(x, fallback = null) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function optionalPositiveNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePantryItem(x) {
  if (!x || typeof x !== "object") return null;
  const name = safeString(x.name, "").trim();
  if (!name) return null;
  const qty = x.qty == null || x.qty === "" ? null : safeNumber(x.qty, null);
  const unit = x.unit == null || x.unit === "" ? null : safeString(x.unit, "").trim();
  const notes = x.notes == null || x.notes === "" ? null : safeString(x.notes, "").trim();
  return { name, qty, unit, notes };
}

function normalizePantry(x) {
  if (!x || typeof x !== "object") return null;
  const id = safeString(x.id, "").trim();
  const name = safeString(x.name, "").trim() || "Склад";
  const text = safeString(x.text, "");
  const items = Array.isArray(x.items)
    ? x.items.map(normalizePantryItem).filter(Boolean)
    : [];
  return { id: id || `p_${Date.now()}`, name, text, items };
}

function normalizePrefs(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return defaultNutritionPrefs();
  const p = { ...defaultNutritionPrefs(), ...x };
  return {
    goal: p.goal ? String(p.goal) : "balanced",
    servings: safeNumber(p.servings, 1) || 1,
    timeMinutes: safeNumber(p.timeMinutes, 25) || 25,
    exclude: p.exclude == null ? "" : String(p.exclude),
    dailyTargetKcal: optionalPositiveNumber(p.dailyTargetKcal),
    dailyTargetProtein_g: optionalPositiveNumber(p.dailyTargetProtein_g),
    dailyTargetFat_g: optionalPositiveNumber(p.dailyTargetFat_g),
    dailyTargetCarbs_g: optionalPositiveNumber(p.dailyTargetCarbs_g),
    mealTemplates: Array.isArray(p.mealTemplates) ? p.mealTemplates.slice(0, 40) : [],
    reminderEnabled: Boolean(p.reminderEnabled),
    reminderHour:
      p.reminderHour != null && Number.isFinite(Number(p.reminderHour))
        ? Math.min(23, Math.max(0, Math.floor(Number(p.reminderHour))))
        : 12,
  };
}

export function buildNutritionBackupPayload() {
  const pantries = readJsonFromLocalStorage(NUTRITION_PANTRIES_KEY, []);
  const activePantryId = safeString(
    typeof localStorage !== "undefined"
      ? localStorage.getItem(NUTRITION_ACTIVE_PANTRY_KEY)
      : "",
    "home",
  );

  // prefs завжди читаємо через loadNutritionPrefs (в ньому дефолти + нормалізація)
  const prefs = loadNutritionPrefs(NUTRITION_PREFS_KEY);

  const log = loadNutritionLog(NUTRITION_LOG_KEY);

  return {
    kind: NUTRITION_BACKUP_KIND,
    schemaVersion: NUTRITION_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      stateSchemaVersion: 1,
      pantries: Array.isArray(pantries) ? pantries.map(normalizePantry).filter(Boolean) : [],
      activePantryId: activePantryId || "home",
      prefs: normalizePrefs(prefs),
      log: log && typeof log === "object" && !Array.isArray(log) ? log : {},
    },
  };
}

export function applyNutritionBackupPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Некоректний бекап харчування.");
  }
  if (payload.kind !== NUTRITION_BACKUP_KIND) {
    throw new Error("Некоректний тип бекапу харчування.");
  }
  if (typeof payload.schemaVersion !== "number") {
    throw new Error("Некоректна версія схеми бекапу харчування.");
  }
  const data = payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Некоректні дані бекапу харчування.");
  }

  const pantries = Array.isArray(data.pantries) ? data.pantries.map(normalizePantry).filter(Boolean) : [];
  const activePantryId = safeString(data.activePantryId, "home") || "home";
  const prefs = normalizePrefs(data.prefs);

  try {
    localStorage.setItem(NUTRITION_PANTRIES_KEY, JSON.stringify(pantries));
  } catch {}
  try {
    localStorage.setItem(NUTRITION_ACTIVE_PANTRY_KEY, activePantryId);
  } catch {}
  try {
    localStorage.setItem(NUTRITION_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  if (data.log && typeof data.log === "object" && !Array.isArray(data.log)) {
    try {
      localStorage.setItem(NUTRITION_LOG_KEY, JSON.stringify(normalizeNutritionLog(data.log)));
    } catch {}
  }
}

