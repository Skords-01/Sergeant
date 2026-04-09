import { useMemo } from "react";
import { useExerciseCatalog } from "./useExerciseCatalog";
import { useWorkouts } from "./useWorkouts";

function daysBetween(aMs, bMs) {
  const DAY = 24 * 60 * 60 * 1000;
  return Math.floor((aMs - bMs) / DAY);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function loadPointsForItem(item) {
  if (!item) return 0;
  if (item.type === "strength") {
    const sets = item.sets || [];
    const tonnage = sets.reduce((s, x) => s + (Number(x.weightKg) || 0) * (Number(x.reps) || 0), 0);
    const setCount = sets.filter(x => (Number(x.reps) || 0) > 0 || (Number(x.weightKg) || 0) > 0).length;
    // 1000 kg of tonnage ≈ 1 point, plus a small per-set component.
    return (tonnage / 1000) + (setCount * 0.15);
  }
  if (item.type === "time") {
    const sec = Number(item.durationSec) || 0;
    return sec / 240; // 4 min = 1 point
  }
  if (item.type === "distance") {
    const km = (Number(item.distanceM) || 0) / 1000;
    const min = (Number(item.durationSec) || 0) / 60;
    // distance dominates, but time adds some stress (hills/slow runs).
    return km + (min / 30);
  }
  return 0;
}

export function useRecovery() {
  const { musclesUk } = useExerciseCatalog();
  const { workouts } = useWorkouts();

  const stats = useMemo(() => {
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const DAY = 24 * 60 * 60 * 1000;

    const muscleIds = new Set(Object.keys(musclesUk || {}));
    for (const w of workouts || []) {
      for (const it of w.items || []) {
        for (const m of it.musclesPrimary || []) muscleIds.add(m);
        for (const m of it.musclesSecondary || []) muscleIds.add(m);
      }
    }

    const by = {};
    for (const id of muscleIds) {
      by[id] = {
        id,
        label: musclesUk?.[id] || id,
        lastAt: null,
        daysSince: null,
        load7d: 0,
        fatigue: 0,
        status: "green",
      };
    }

    for (const w of workouts || []) {
      const t = w.startedAt ? Date.parse(w.startedAt) : NaN;
      if (!Number.isFinite(t)) continue;
      const in7d = (now - t) <= WEEK;
      for (const it of w.items || []) {
        const ptsBase = loadPointsForItem(it);
        const ageDays = Math.max(0, (now - t) / DAY);
        // Exponential decay: last 48h matters much more than a week ago.
        const decay = Math.exp(-ageDays / 2.2);

        const apply = (m, wgt) => {
          if (!m) return;
          if (!by[m]) by[m] = { id: m, label: musclesUk?.[m] || m, lastAt: null, daysSince: null, load7d: 0, fatigue: 0, status: "green" };
          by[m].lastAt = by[m].lastAt == null ? t : Math.max(by[m].lastAt, t);
          if (in7d) by[m].load7d += ptsBase * wgt;
          by[m].fatigue += ptsBase * wgt * decay;
        };

        for (const m of it.musclesPrimary || []) apply(m, 1);
        for (const m of it.musclesSecondary || []) apply(m, 0.55);
      }
    }

    for (const m of Object.values(by)) {
      if (m.lastAt != null) {
        m.daysSince = clamp(daysBetween(now, m.lastAt), 0, 999);
      }
      // Status from short-term fatigue + recency (simple but robust).
      if (m.lastAt == null) m.status = "green";
      else if (m.daysSince <= 1) m.status = "red";
      else if (m.fatigue >= 4.5) m.status = "red";
      else if (m.fatigue >= 2.2 || m.daysSince <= 3) m.status = "yellow";
      else m.status = "green";
    }

    const list = Object.values(by)
      .filter(x => x.id && x.label)
      .sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999) || (b.load7d - a.load7d));

    const ready = list.filter(x => x.lastAt == null || x.status === "green").slice(0, 4);
    const avoid = list.filter(x => x.status === "red").slice(0, 4);

    return { by, list, ready, avoid };
  }, [workouts, musclesUk]);

  return stats;
}

