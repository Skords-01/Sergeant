/** UI helpers for workout logging (pure, no React). */

export const ACTIVE_WORKOUT_KEY = "fizruk_active_workout_id_v1";
/** @deprecated Використовуй клас `fizruk-sheet-pad` у index.css */
export const SHEET_BOTTOM_PADDING =
  "calc(env(safe-area-inset-bottom, 16px) + 72px)";
export const SHEET_Z = "z-[100]";
export const FIZRUK_SHEET_PAD_CLASS = "fizruk-sheet-pad";

export function summarizeWorkoutForFinish(w) {
  if (!w?.startedAt) return null;
  const start = Date.parse(w.startedAt);
  const end = w.endedAt ? Date.parse(w.endedAt) : Date.now();
  if (!Number.isFinite(start)) return null;
  if (!Number.isFinite(end)) return null;
  const durationSec = Math.max(0, Math.floor((end - start) / 1000));
  const items = (w.items || []).length;
  let tonnageKg = 0;
  for (const it of w.items || []) {
    if (it.type === "strength") {
      for (const s of it.sets || []) {
        tonnageKg += (Number(s.weightKg) || 0) * (Number(s.reps) || 0);
      }
    }
  }
  return { durationSec, items, tonnageKg };
}

export function formatDurShort(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s} с`;
  return `${m} хв ${s} с`;
}

export function formatRestClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function mondayStartMs(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}
