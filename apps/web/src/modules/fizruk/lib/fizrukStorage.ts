/**
 * Web-only обгортка над localStorage для Фізрука. Усі pure-шматки
 * (ключі, schema-версії, parse/serialize/merge) живуть у пакеті
 * `@sergeant/fizruk-domain`; цей файл лише додає персист через
 * `createModuleStorage` для apps/web.
 */

import { createModuleStorage } from "@shared/lib/createModuleStorage";
import {
  CUSTOM_EXERCISES_KEY,
  FIZRUK_FULL_BACKUP_KEYS,
  WORKOUTS_STORAGE_KEY,
  mergeCustomById,
  mergeWorkoutsById,
  parseCustomExercisesFromStorage,
  parseWorkoutsFromStorage,
  serializeCustomExercisesToStorage,
  serializeWorkoutsToStorage,
} from "@sergeant/fizruk-domain";

export {
  ACTIVE_WORKOUT_KEY,
  CUSTOM_EXERCISES_KEY,
  CUSTOM_SCHEMA_VERSION,
  FIZRUK_FULL_BACKUP_KEYS,
  FIZRUK_RESET_KEYS,
  MEASUREMENTS_STORAGE_KEY,
  MONTHLY_PLAN_STORAGE_KEY,
  PLAN_TEMPLATE_STORAGE_KEY,
  SELECTED_TEMPLATE_STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
  WORKOUTS_SCHEMA_VERSION,
  WORKOUTS_STORAGE_KEY,
  mergeCustomById,
  mergeWorkoutsById,
  parseCustomExercisesFromStorage,
  parseWorkoutsFromStorage,
  serializeCustomExercisesToStorage,
  serializeWorkoutsToStorage,
} from "@sergeant/fizruk-domain";

const storage = createModuleStorage({ name: "fizruk" });

/** Full backup blob for export/import. */
export function buildFizrukBackupPayload() {
  const workoutsRaw = storage.readRaw(WORKOUTS_STORAGE_KEY, null);
  const customRaw = storage.readRaw(CUSTOM_EXERCISES_KEY, null);
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
    storage.writeRaw(WORKOUTS_STORAGE_KEY, serializeWorkoutsToStorage(w));
    storage.writeRaw(
      CUSTOM_EXERCISES_KEY,
      serializeCustomExercisesToStorage(c),
    );
    return { workouts: w.length, customExercises: c.length };
  }
  const existingW = parseWorkoutsFromStorage(
    storage.readRaw(WORKOUTS_STORAGE_KEY, null),
  );
  const existingC = parseCustomExercisesFromStorage(
    storage.readRaw(CUSTOM_EXERCISES_KEY, null),
  );
  const mergedW = mergeWorkoutsById(existingW, w);
  const mergedC = mergeCustomById(existingC, c);
  storage.writeRaw(WORKOUTS_STORAGE_KEY, serializeWorkoutsToStorage(mergedW));
  storage.writeRaw(
    CUSTOM_EXERCISES_KEY,
    serializeCustomExercisesToStorage(mergedC),
  );
  return { workouts: mergedW.length, customExercises: mergedC.length };
}

/**
 * Повний знімок localStorage для Progress (заміри, шаблони тощо).
 * Сумісний з попереднім форматом `{ schemaVersion, exportedAt, data }`.
 */
export function buildFizrukFullBackupPayload() {
  const data = {};
  for (const k of FIZRUK_FULL_BACKUP_KEYS) {
    data[k] = storage.readRaw(k, null);
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
    if (typeof v === "string") storage.writeRaw(k, v);
  }
}
