/** Pure helpers for dashboard / analytics (kg, local week Mon–Sun). */

/**
 * Формула Еплі для оцінки 1ПМ (1 повторний максимум).
 * Виноситься як публічна функція, щоб не дублюватись в Exercise.jsx і Progress.jsx.
 */
export function epley1rm(weightKg, reps) {
  const wg = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (wg <= 0 || r <= 0) return 0;
  return wg * (1 + r / 30);
}

function roundToStep(x, step) {
  const s = Number(step) || 1;
  return Math.round(x / s) * s;
}

/**
 * Повертає особистий рекорд по вправі: { best1rm, bestSet: {weightKg, reps}, date }.
 * Враховує всі тренування у `workouts`.
 */
export function getExercisePR(workouts, exerciseId) {
  let best1rm = 0;
  let bestSet = null;
  let bestDate = null;
  for (const w of workouts || []) {
    for (const it of w.items || []) {
      if (it.exerciseId !== exerciseId || it.type !== "strength") continue;
      for (const s of it.sets || []) {
        const est = epley1rm(s.weightKg, s.reps);
        if (est > best1rm) {
          best1rm = est;
          bestSet = { weightKg: s.weightKg, reps: s.reps };
          bestDate = w.startedAt || null;
        }
      }
    }
  }
  return { best1rm, bestSet, date: bestDate };
}

/**
 * Рекомендує наступний сет на основі останнього кращого сету (за 3 зонами):
 *   reps ≤ 5  → +2.5 кг, ті самі повт.
 *   reps 6-10 → primary: +2.5 кг / ті самі повт.
 *               alt: та сама вага / +1 повт.
 *   reps > 10 → +5% ваги (округл. до 2.5 кг), ті самі повт.
 * Повертає { weightKg, reps, altWeightKg?, altReps? } або null.
 */
export function suggestNextSet(lastBestSet) {
  const w = Number(lastBestSet?.weightKg) || 0;
  const r = Number(lastBestSet?.reps) || 0;
  if (w <= 0 || r <= 0) return null;

  if (r <= 5) {
    return { weightKg: roundToStep(w + 2.5, 2.5), reps: r };
  }
  if (r <= 10) {
    return {
      weightKg: roundToStep(w + 2.5, 2.5),
      reps: r,
      altWeightKg: w,
      altReps: r + 1,
    };
  }
  return { weightKg: roundToStep(w * 1.05, 2.5), reps: r };
}

export function workoutTonnageKg(w) {
  let t = 0;
  for (const it of w.items || []) {
    if (it.type === "strength") {
      for (const s of it.sets || []) {
        t += (Number(s.weightKg) || 0) * (Number(s.reps) || 0);
      }
    }
  }
  return t;
}

export function workoutDurationSec(w) {
  if (!w?.startedAt) return 0;
  const start = Date.parse(w.startedAt);
  const end = w.endedAt ? Date.parse(w.endedAt) : Date.now();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Кількість вправ, де є хоча б один зафіксований «рекорд» за оцінкою Еплі. */
export function personalRecordsExerciseCount(workouts) {
  const by = {};
  for (const w of workouts || []) {
    for (const it of w.items || []) {
      const exId = it.exerciseId;
      if (!exId || it.type !== "strength") continue;
      for (const s of it.sets || []) {
        const est = epley1rm(s.weightKg, s.reps);
        if (!est) continue;
        if (!by[exId] || est > by[exId]) by[exId] = est;
      }
    }
  }
  return Object.keys(by).length;
}

/** Початок поточного ISO-тижня (Пн 00:00) у мс. */
export function mondayStartMs(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 7 значень (Пн…Нд) для поточного календарного тижня, кг×повторення за день. */
export function weeklyVolumeSeriesNow(workouts) {
  const week0 = mondayStartMs(Date.now());
  const vol = [0, 0, 0, 0, 0, 0, 0];

  for (const w of workouts || []) {
    if (!w.endedAt) continue;
    const t = w.startedAt ? Date.parse(w.startedAt) : NaN;
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const idx = Math.round((d0 - week0) / DAY_MS);
    if (idx < 0 || idx > 6) continue;
    vol[idx] += workoutTonnageKg(w);
  }
  return { weekStartMs: week0, volumeKg: vol };
}

export function formatCompactKg(kg) {
  const n = Number(kg) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function completedWorkoutsCount(workouts) {
  return (workouts || []).filter((w) => w.endedAt).length;
}

export function countCompletedInCurrentWeek(workouts) {
  const week0 = mondayStartMs(Date.now());
  let n = 0;
  for (const w of workouts || []) {
    if (!w.endedAt) continue;
    const t = w.startedAt ? Date.parse(w.startedAt) : NaN;
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const idx = Math.round((d0 - week0) / DAY_MS);
    if (idx >= 0 && idx <= 6) n += 1;
  }
  return n;
}

export function totalCompletedVolumeKg(workouts) {
  let s = 0;
  for (const w of workouts || []) {
    if (!w.endedAt) continue;
    s += workoutTonnageKg(w);
  }
  return s;
}
