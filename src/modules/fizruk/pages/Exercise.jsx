import { useMemo } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useWorkouts } from "../hooks/useWorkouts";

function epley1rm(weightKg, reps) {
  const w = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + (r / 30));
}

function fmt(n, digits = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function roundToStep(x, step) {
  const s = Number(step) || 1;
  if (s <= 0) return x;
  return Math.round(x / s) * s;
}

export function Exercise({ exerciseId }) {
  const { exercises, musclesUk } = useExerciseCatalog();
  const { workouts } = useWorkouts();

  const ex = useMemo(() => (exercises || []).find(x => x?.id === exerciseId) || null, [exercises, exerciseId]);

  const history = useMemo(() => {
    const out = [];
    for (const w of workouts || []) {
      for (const it of w.items || []) {
        if (it.exerciseId !== exerciseId) continue;
        out.push({ workout: w, item: it });
      }
    }
    return out.sort((a, b) => (b.workout?.startedAt || "").localeCompare(a.workout?.startedAt || ""));
  }, [workouts, exerciseId]);

  const best = useMemo(() => {
    let best1rm = 0;
    let bestSet = null;
    let lastTop = null;
    for (const { workout, item } of history) {
      if (item?.type !== "strength") continue;
      const sets = item.sets || [];
      for (const s of sets) {
        const est = epley1rm(s.weightKg, s.reps);
        if (est > best1rm) {
          best1rm = est;
          bestSet = { ...s, _at: workout?.startedAt };
        }
        if (!lastTop) lastTop = { ...s, _at: workout?.startedAt };
      }
    }
    return { best1rm, bestSet, lastTop };
  }, [history]);

  const suggestedNext = useMemo(() => {
    if (!best.lastTop) return null;
    const w = Number(best.lastTop.weightKg) || 0;
    const r = Number(best.lastTop.reps) || 0;
    if (w <= 0 || r <= 0) return null;
    // Conservative progression: +2.5% rounded to 2.5kg.
    const nextW = roundToStep(w * 1.025, 2.5);
    return { weightKg: nextW, reps: r };
  }, [best.lastTop]);

  const muscleLabels = useMemo(() => {
    const ids = ex?.muscles?.primary || [];
    return ids.map(id => musclesUk?.[id] || id).filter(Boolean);
  }, [ex, musclesUk]);

  if (!exerciseId) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card text-sm text-subtle">Невірний ID вправи</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-3">

        <section
          className="rounded-3xl p-5 border border-line/20"
          style={{ background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)" }}
          aria-label="Профіль вправи"
        >
          <p className="text-[11px] font-bold tracking-widest uppercase text-accent">Профіль вправи</p>
          <h1 className="text-2xl font-black text-white mt-2 leading-tight">
            {ex?.name?.uk || ex?.name?.en || history?.[0]?.item?.nameUk || "Вправа"}
          </h1>
          {muscleLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {muscleLabels.map(m => (
                <span key={m} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/15 text-white/80 border border-white/20">
                  {m}
                </span>
              ))}
            </div>
          )}
          {muscleLabels.length === 0 && (
            <p className="text-xs text-white/50 mt-2">Додай мʼязи в каталозі для точнішої аналітики</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Best 1RM (оцінка)</div>
            <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">{best.best1rm ? `${fmt(best.best1rm, 0)} кг` : "—"}</div>
            <div className="text-xs text-subtle mt-1">
              {best.bestSet ? `${best.bestSet.weightKg ?? 0}×${best.bestSet.reps ?? 0}` : "Немає силових сетів"}
            </div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Рекомендація</div>
            <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">{suggestedNext ? `${fmt(suggestedNext.weightKg, 1)} кг` : "—"}</div>
            <div className="text-xs text-subtle mt-1">{suggestedNext ? `на ~${suggestedNext.reps} повторів` : "Заповни останній сет, щоб зʼявилась прогресія"}</div>
          </div>
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Історія сетів</div>
          {history.length === 0 ? (
            <div className="text-sm text-subtle text-center py-6">Ще немає записів по цій вправі</div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 20).map(({ workout, item }) => (
                <div key={`${workout.id}_${item.id}`} className="border border-line rounded-2xl p-3 bg-bg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-subtle">
                      {workout?.startedAt ? new Date(workout.startedAt).toLocaleDateString("uk-UA", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                    </div>
                    <div className={cn("text-[10px] px-2 py-1 rounded-full border", item.type === "strength" ? "border-line text-subtle" : "border-line text-subtle")}>
                      {item.type === "strength" ? "силова" : item.type === "distance" ? "дистанція" : "час"}
                    </div>
                  </div>
                  <div className="text-sm text-text mt-2">
                    {item.type === "strength"
                      ? (item.sets || []).map(s => `${s.weightKg ?? 0}×${s.reps ?? 0}`).join(", ") || "—"
                      : item.type === "distance"
                        ? `${item.distanceM ?? 0} м за ${item.durationSec ?? 0} с`
                        : `${item.durationSec ?? 0} с`
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              className="w-full py-4 rounded-full font-bold text-[15px] bg-accent"
              style={{ color: "#0f2d1a" }}
              onClick={() => (window.location.hash = "#workouts")}
            >
              Перейти до журналу
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

