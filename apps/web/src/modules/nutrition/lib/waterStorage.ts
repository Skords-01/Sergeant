/**
 * Web I/O-адаптер для журналу води.
 *
 * Pure-логіка (`normalizeWaterLog`, `addWaterMl`, `getTodayWaterMl`,
 * `resetTodayWater`, тип `WaterLog`, ключ `WATER_LOG_KEY`) живе у
 * `@sergeant/nutrition-domain` і спільна з `apps/mobile`. Тут лишаються
 * лише load/save поверх `createModuleStorage`.
 */
import {
  WATER_LOG_KEY,
  normalizeWaterLog,
  type WaterLog,
} from "@sergeant/nutrition-domain";

import { nutritionStorage } from "./nutritionStorageInstance.js";

export {
  WATER_LOG_KEY,
  addWaterMl,
  subtractWaterMl,
  getTodayWaterMl,
  normalizeWaterLog,
  resetTodayWater,
} from "@sergeant/nutrition-domain";
export type { WaterLog } from "@sergeant/nutrition-domain";

export function loadWaterLog(key: string = WATER_LOG_KEY): WaterLog {
  return normalizeWaterLog(nutritionStorage.readJSON(key, {}));
}

export function saveWaterLog(
  log: unknown,
  key: string = WATER_LOG_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, normalizeWaterLog(log));
}
