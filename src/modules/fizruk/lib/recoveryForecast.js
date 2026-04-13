import { computeRecoveryBy, isFullyRecovered } from "./recoveryCompute.js";

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 21;

function localDateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Для кожного м'яза з навантаженням — перша дата (YYYY-MM-DD локальний день), коли статус стане «повністю відновлений» (green).
 * Якщо вже green зараз — сьогодні; якщо за MAX_DAYS не досягнуто — null.
 */
export function forecastFullRecoveryByDate(
  workouts,
  musclesUk,
  nowMs = Date.now(),
) {
  const out = {};

  const byNow = computeRecoveryBy(workouts, musclesUk, nowMs);
  const ids = Object.keys(byNow).filter((id) => byNow[id].lastAt != null);

  for (const id of ids) {
    if (isFullyRecovered(byNow[id])) {
      out[id] = localDateKey(nowMs);
      continue;
    }
    let found = null;
    for (let d = 1; d <= MAX_DAYS; d++) {
      const future = nowMs + d * DAY;
      const by = computeRecoveryBy(workouts, musclesUk, future);
      const row = by[id];
      if (row && isFullyRecovered(row)) {
        found = localDateKey(future);
        break;
      }
    }
    out[id] = found;
  }

  return out;
}
