import {
  NUTRITION_ACTIVE_PANTRY_KEY,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_PREFS_KEY,
  NUTRITION_LOG_KEY,
  defaultNutritionPrefs,
  loadNutritionPrefs,
  loadNutritionLog,
  normalizeNutritionLog,
  type NutritionLog,
  type NutritionPrefs,
} from "../lib/nutritionStorage.js";

export const NUTRITION_BACKUP_KIND = "hub-nutrition-backup";
export const NUTRITION_BACKUP_SCHEMA_VERSION = 1;

export interface NutritionBackupPantryItem {
  name: string;
  qty: number | null;
  unit: string | null;
  notes: string | null;
}

export interface NutritionBackupPantry {
  id: string;
  name: string;
  text: string;
  items: NutritionBackupPantryItem[];
}

export interface NutritionBackupData {
  stateSchemaVersion: 1;
  pantries: NutritionBackupPantry[];
  activePantryId: string;
  prefs: NutritionPrefs;
  log: NutritionLog | Record<string, unknown>;
}

export interface NutritionBackupPayload {
  kind: typeof NUTRITION_BACKUP_KIND;
  schemaVersion: number;
  exportedAt: string;
  data: NutritionBackupData;
}

function readJsonFromLocalStorage<T>(key: string, fallback: T): T | unknown {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const s = localStorage.getItem(key);
    if (s === null) return fallback;
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function safeString(x: unknown, fallback = ""): string {
  return x == null ? fallback : String(x);
}

function safeNumber(x: unknown, fallback: number | null = null): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function optionalPositiveNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePantryItem(x: unknown): NutritionBackupPantryItem | null {
  if (!x || typeof x !== "object") return null;
  const rec = x as Record<string, unknown>;
  const name = safeString(rec.name, "").trim();
  if (!name) return null;
  const qty =
    rec.qty == null || rec.qty === "" ? null : safeNumber(rec.qty, null);
  const unit =
    rec.unit == null || rec.unit === ""
      ? null
      : safeString(rec.unit, "").trim();
  const notes =
    rec.notes == null || rec.notes === ""
      ? null
      : safeString(rec.notes, "").trim();
  return { name, qty, unit, notes };
}

function normalizePantry(x: unknown): NutritionBackupPantry | null {
  if (!x || typeof x !== "object") return null;
  const rec = x as Record<string, unknown>;
  const id = safeString(rec.id, "").trim();
  const name = safeString(rec.name, "").trim() || "Склад";
  const text = safeString(rec.text, "");
  const items = Array.isArray(rec.items)
    ? rec.items
        .map(normalizePantryItem)
        .filter((v): v is NutritionBackupPantryItem => v != null)
    : [];
  return { id: id || `p_${Date.now()}`, name, text, items };
}

function normalizePrefs(x: unknown): NutritionPrefs {
  if (!x || typeof x !== "object" || Array.isArray(x))
    return defaultNutritionPrefs();
  const p = { ...defaultNutritionPrefs(), ...(x as Partial<NutritionPrefs>) };
  return {
    goal: p.goal ? String(p.goal) : "balanced",
    servings: safeNumber(p.servings, 1) || 1,
    timeMinutes: safeNumber(p.timeMinutes, 25) || 25,
    exclude: p.exclude == null ? "" : String(p.exclude),
    dailyTargetKcal: optionalPositiveNumber(p.dailyTargetKcal),
    dailyTargetProtein_g: optionalPositiveNumber(p.dailyTargetProtein_g),
    dailyTargetFat_g: optionalPositiveNumber(p.dailyTargetFat_g),
    dailyTargetCarbs_g: optionalPositiveNumber(p.dailyTargetCarbs_g),
    mealTemplates: Array.isArray(p.mealTemplates)
      ? p.mealTemplates.slice(0, 40)
      : [],
    reminderEnabled: Boolean(p.reminderEnabled),
    reminderHour:
      p.reminderHour != null && Number.isFinite(Number(p.reminderHour))
        ? Math.min(23, Math.max(0, Math.floor(Number(p.reminderHour))))
        : 12,
    waterGoalMl:
      p.waterGoalMl != null && Number.isFinite(Number(p.waterGoalMl))
        ? Math.max(0, Math.floor(Number(p.waterGoalMl)))
        : 2000,
  };
}

export function buildNutritionBackupPayload(): NutritionBackupPayload {
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
      pantries: Array.isArray(pantries)
        ? pantries
            .map(normalizePantry)
            .filter((v): v is NutritionBackupPantry => v != null)
        : [],
      activePantryId: activePantryId || "home",
      prefs: normalizePrefs(prefs),
      log: log && typeof log === "object" && !Array.isArray(log) ? log : {},
    },
  };
}

export function applyNutritionBackupPayload(payload: unknown): void {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Некоректний бекап харчування.");
  }
  const p = payload as Record<string, unknown>;
  if (p.kind !== NUTRITION_BACKUP_KIND) {
    throw new Error("Некоректний тип бекапу харчування.");
  }
  if (typeof p.schemaVersion !== "number") {
    throw new Error("Некоректна версія схеми бекапу харчування.");
  }
  const data = p.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Некоректні дані бекапу харчування.");
  }

  const pantries = Array.isArray(data.pantries)
    ? data.pantries
        .map(normalizePantry)
        .filter((v): v is NutritionBackupPantry => v != null)
    : [];
  const activePantryId = safeString(data.activePantryId, "home") || "home";
  const prefs = normalizePrefs(data.prefs);

  try {
    localStorage.setItem(NUTRITION_PANTRIES_KEY, JSON.stringify(pantries));
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(NUTRITION_ACTIVE_PANTRY_KEY, activePantryId);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(NUTRITION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  if (data.log && typeof data.log === "object" && !Array.isArray(data.log)) {
    try {
      localStorage.setItem(
        NUTRITION_LOG_KEY,
        JSON.stringify(normalizeNutritionLog(data.log)),
      );
    } catch {
      /* ignore */
    }
  }
}
