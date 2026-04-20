/** UI-agnostic helpers for workout logging (pure, no React / no DOM). */

import type { Workout } from "../domain/types";

export { ACTIVE_WORKOUT_KEY } from "../constants";

/** @deprecated Використовуй клас `fizruk-sheet-pad` у index.css */
export const SHEET_BOTTOM_PADDING =
  "calc(env(safe-area-inset-bottom, 16px) + 72px)";
export const SHEET_Z = "z-[100]";
export const FIZRUK_SHEET_PAD_CLASS = "fizruk-sheet-pad";

export interface WorkoutFinishSummary {
  durationSec: number;
  items: number;
  tonnageKg: number;
}

export function summarizeWorkoutForFinish(
  w: Partial<Workout> | null | undefined,
): WorkoutFinishSummary | null {
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

export function formatDurShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s} с`;
  return `${m} хв ${s} с`;
}

export function formatRestClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
