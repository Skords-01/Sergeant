import { toLocalISODate } from "@shared/lib/date.js";
import { nutritionStorage } from "./nutritionStorageInstance.js";

export const WATER_LOG_KEY = "nutrition_water_v1";
export const DEFAULT_WATER_GOAL_ML = 2000;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeMl(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function normalizeWaterLog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ISO_DATE_RE.test(k)) continue;
    const ml = sanitizeMl(v);
    if (ml > 0) out[k] = ml;
  }
  return out;
}

export function loadWaterLog(key = WATER_LOG_KEY) {
  return normalizeWaterLog(nutritionStorage.readJSON(key, {}));
}

export function saveWaterLog(log, key = WATER_LOG_KEY) {
  return nutritionStorage.writeJSON(key, normalizeWaterLog(log));
}

export function getTodayWaterMl(log) {
  const today = toLocalISODate();
  const n = Number(log?.[today]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function addWaterMl(log, ml) {
  const delta = sanitizeMl(ml);
  if (delta <= 0) return normalizeWaterLog(log);
  const base = normalizeWaterLog(log);
  const today = toLocalISODate();
  return { ...base, [today]: (base[today] || 0) + delta };
}

export function resetTodayWater(log) {
  const base = normalizeWaterLog(log);
  const today = toLocalISODate();
  const { [today]: _removed, ...rest } = base;
  return rest;
}
