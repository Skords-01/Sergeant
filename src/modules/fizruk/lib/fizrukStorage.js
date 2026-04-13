/** Shared parsing/serialization for Fizruk localStorage (workouts + custom exercises). */

export const WORKOUTS_STORAGE_KEY = "fizruk_workouts_v1";
export const CUSTOM_EXERCISES_KEY = "fizruk_custom_exercises_v1";
export const MEASUREMENTS_STORAGE_KEY = "fizruk_measurements_v1";
export const TEMPLATES_STORAGE_KEY = "fizruk_workout_templates_v1";
export const SELECTED_TEMPLATE_STORAGE_KEY = "fizruk_selected_template_id_v1";
export const ACTIVE_WORKOUT_STORAGE_KEY = "fizruk_active_workout_id_v1";
export const PLAN_TEMPLATE_STORAGE_KEY = "fizruk_plan_template_v1";
export const MONTHLY_PLAN_STORAGE_KEY = "fizruk_monthly_plan_v1";

export const WORKOUTS_SCHEMA_VERSION = 1;
export const CUSTOM_SCHEMA_VERSION = 1;

/** Ключі для експорту «всі дані Фізрука» (Progress). */
export const FIZRUK_FULL_BACKUP_KEYS = [
  WORKOUTS_STORAGE_KEY,
  MEASUREMENTS_STORAGE_KEY,
  CUSTOM_EXERCISES_KEY,
  TEMPLATES_STORAGE_KEY,
  SELECTED_TEMPLATE_STORAGE_KEY,
  MONTHLY_PLAN_STORAGE_KEY,
];

/** Скидання разом із службовими ключами сесії тренування. */
export const FIZRUK_RESET_KEYS = [
  ...FIZRUK_FULL_BACKUP_KEYS,
  ACTIVE_WORKOUT_STORAGE_KEY,
  PLAN_TEMPLATE_STORAGE_KEY,
];

/** Legacy: plain JSON array. Current: `{ schemaVersion, workouts }`. */
export function parseWorkoutsFromStorage(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.workouts)) return p.workouts;
  } catch {}
  return [];
}

export function serializeWorkoutsToStorage(workouts) {
  return JSON.stringify({
    schemaVersion: WORKOUTS_SCHEMA_VERSION,
    workouts: Array.isArray(workouts) ? workouts : [],
  });
}

/** Legacy: JSON array. Current: `{ schemaVersion, exercises }`. */
export function parseCustomExercisesFromStorage(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.exercises)) return p.exercises;
  } catch {}
  return [];
}

export function serializeCustomExercisesToStorage(exercises) {
  return JSON.stringify({
    schemaVersion: CUSTOM_SCHEMA_VERSION,
    exercises: Array.isArray(exercises) ? exercises : [],
  });
}

/** Full backup blob for export/import. */
export function buildFizrukBackupPayload() {
  const workoutsRaw =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(WORKOUTS_STORAGE_KEY)
      : null;
  const customRaw =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(CUSTOM_EXERCISES_KEY)
      : null;
  return {
    kind: "fizruk-backup",
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    workouts: parseWorkoutsFromStorage(workoutsRaw),
    customExercises: parseCustomExercisesFromStorage(customRaw),
  };
}

export function applyFizrukBackupPayload(data, { replace = false } = {}) {
  if (!data || data.kind !== "fizruk-backup")
    throw new Error("Невірний формат файлу");
  const w = Array.isArray(data.workouts) ? data.workouts : [];
  const c = Array.isArray(data.customExercises) ? data.customExercises : [];
  if (replace) {
    localStorage.setItem(WORKOUTS_STORAGE_KEY, serializeWorkoutsToStorage(w));
    localStorage.setItem(
      CUSTOM_EXERCISES_KEY,
      serializeCustomExercisesToStorage(c),
    );
    return { workouts: w.length, customExercises: c.length };
  }
  const existingW = parseWorkoutsFromStorage(
    localStorage.getItem(WORKOUTS_STORAGE_KEY),
  );
  const existingC = parseCustomExercisesFromStorage(
    localStorage.getItem(CUSTOM_EXERCISES_KEY),
  );
  const mergedW = mergeWorkoutsById(existingW, w);
  const mergedC = mergeCustomById(existingC, c);
  localStorage.setItem(
    WORKOUTS_STORAGE_KEY,
    serializeWorkoutsToStorage(mergedW),
  );
  localStorage.setItem(
    CUSTOM_EXERCISES_KEY,
    serializeCustomExercisesToStorage(mergedC),
  );
  return { workouts: mergedW.length, customExercises: mergedC.length };
}

function mergeWorkoutsById(a, b) {
  const byId = new Map();
  for (const x of a || []) if (x?.id) byId.set(x.id, x);
  for (const x of b || []) if (x?.id) byId.set(x.id, x);
  return [...byId.values()].sort((x, y) =>
    (y.startedAt || "").localeCompare(x.startedAt || ""),
  );
}

function mergeCustomById(a, b) {
  const byId = new Map();
  for (const x of a || []) if (x?.id) byId.set(x.id, x);
  for (const x of b || []) if (x?.id) byId.set(x.id, x);
  return [...byId.values()];
}

/**
 * Повний знімок localStorage для Progress (заміри, шаблони тощо).
 * Сумісний з попереднім форматом `{ schemaVersion, exportedAt, data }`.
 */
export function buildFizrukFullBackupPayload() {
  const data = {};
  for (const k of FIZRUK_FULL_BACKUP_KEYS) {
    try {
      data[k] =
        typeof localStorage !== "undefined" ? localStorage.getItem(k) : null;
    } catch {
      data[k] = null;
    }
  }
  return {
    kind: "fizruk-full-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Імпорт повного бекапу (той самий формат, що buildFizrukFullBackupPayload, або legacy без `kind`).
 */
export function applyFizrukFullBackupPayload(parsed) {
  const d = parsed?.data;
  if (!d || typeof d !== "object") throw new Error("Невірний формат файлу");
  for (const k of FIZRUK_FULL_BACKUP_KEYS) {
    const v = d[k];
    if (typeof v === "string") localStorage.setItem(k, v);
  }
}
