import { toLocalISODate } from "@shared/lib/date";
import { nutritionStorage } from "./nutritionStorageInstance.js";

export const WATER_LOG_KEY = "nutrition_water_v1";
export const DEFAULT_WATER_GOAL_ML = 2000;

export type WaterLog = Record<string, number>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeMl(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function normalizeWaterLog(raw: unknown): WaterLog {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: WaterLog = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_DATE_RE.test(k)) continue;
    const ml = sanitizeMl(v);
    if (ml > 0) out[k] = ml;
  }
  return out;
}

export function loadWaterLog(key: string = WATER_LOG_KEY): WaterLog {
  return normalizeWaterLog(nutritionStorage.readJSON(key, {}));
}

export function saveWaterLog(
  log: unknown,
  key: string = WATER_LOG_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, normalizeWaterLog(log));
}

export function getTodayWaterMl(log: unknown): number {
  if (!log || typeof log !== "object") return 0;
  const today = toLocalISODate();
  const n = Number((log as Record<string, unknown>)[today]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function addWaterMl(log: unknown, ml: unknown): WaterLog {
  const delta = sanitizeMl(ml);
  if (delta <= 0) return normalizeWaterLog(log);
  const base = normalizeWaterLog(log);
  const today = toLocalISODate();
  return { ...base, [today]: (base[today] || 0) + delta };
}

export function resetTodayWater(log: unknown): WaterLog {
  const base = normalizeWaterLog(log);
  const today = toLocalISODate();
  const { [today]: _removed, ...rest } = base;
  void _removed;
  return rest;
}
