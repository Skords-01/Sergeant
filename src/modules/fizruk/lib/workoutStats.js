/** Pure helpers for dashboard / analytics (kg, local week Mon–Sun). */

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

function epley1rm(weightKg, reps) {
  const wg = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (wg <= 0 || r <= 0) return 0;
  return wg * (1 + r / 30);
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

function mondayStartMs(d) {
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
