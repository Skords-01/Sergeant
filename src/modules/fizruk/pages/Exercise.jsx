import { useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useWorkouts } from "../hooks/useWorkouts";

function epley1rm(weightKg, reps) {
  const w = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + r / 30);
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

function ProgressChart({ points, label, unit, color }) {
  if (!points || points.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-line/60 bg-panelHi/50 py-6 text-center text-xs text-subtle">
        Потрібно щонайменше 2 тренування для графіка
      </div>
    );
  }

  const vals = points.map((p) => p.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;

  const w = 320;
  const h = 90;
  const padL = 38;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = points.length;
  const step = n > 1 ? innerW / (n - 1) : innerW;

  const mapped = points.map((p, i) => {
    const x = padL + i * step;
    const pct = (p.value - minVal) / range;
    const y = padT + innerH - pct * innerH;
    return { x, y, ...p };
  });

  const lineD = mapped
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaD =
    `${lineD} L ${mapped[mapped.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${mapped[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const gradId = `prog_${label.replace(/\s/g, "_")}`;

  const yTicks = [0, 0.5, 1].map((fr) => ({
    y: padT + innerH * (1 - fr),
    lab: (minVal + fr * range).toFixed(0),
  }));

  const labelSet = new Set([0, n - 1]);
  if (n > 3) labelSet.add(Math.floor(n / 2));

  const lastVal = points[points.length - 1]?.value;
  const firstVal = points[0]?.value;
  const delta = lastVal - firstVal;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto max-h-[120px] overflow-visible"
        role="img"
        aria-label={`Графік ${label}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={t.y} y2={t.y} stroke="currentColor" className="text-line/60" strokeWidth="1" strokeDasharray="3 4" />
            <text x={padL - 4} y={t.y + 4} textAnchor="end" fontSize="9" className="fill-subtle">{t.lab}</text>
          </g>
        ))}
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {mapped.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1.5" />
        ))}
        {mapped.map((p, i) => {
          if (!labelSet.has(i)) return null;
          return (
            <text key={i} x={p.x} y={h - 4} textAnchor="middle" fontSize="8" className="fill-muted">
              {p.dateLabel}
            </text>
          );
        })}
      </svg>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-lg font-extrabold tabular-nums text-text">
          {fmt(lastVal, 1)} {unit}
        </span>
        {delta !== 0 && Number.isFinite(delta) && (
          <span className={cn("text-xs font-semibold", delta > 0 ? "text-success" : "text-warning")}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)} {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function Exercise({ exerciseId }) {
  const { exercises, musclesUk } = useExerciseCatalog();
  const { workouts } = useWorkouts();

  const ex = useMemo(
    () => (exercises || []).find((x) => x?.id === exerciseId) || null,
    [exercises, exerciseId],
  );

  const history = useMemo(() => {
    const out = [];
    for (const w of workouts || []) {
      for (const it of w.items || []) {
        if (it.exerciseId !== exerciseId) continue;
        out.push({ workout: w, item: it });
      }
    }
    return out.sort((a, b) =>
      (b.workout?.startedAt || "").localeCompare(a.workout?.startedAt || ""),
    );
  }, [workouts, exerciseId]);

  const best = useMemo(() => {
    let best1rm = 0;
    let bestSet = null;
    let lastTop = null;
    let lastWorkoutId = null;
    let lastWorkoutBest1rm = 0;
    let priorBest1rm = 0;

    if (history.length > 0) lastWorkoutId = history[0].workout?.id;

    for (const { workout, item } of history) {
      if (item?.type !== "strength") continue;
      const isLatest = workout?.id === lastWorkoutId;
      const sets = item.sets || [];
      for (const s of sets) {
        const est = epley1rm(s.weightKg, s.reps);
        if (est > best1rm) {
          best1rm = est;
          bestSet = { ...s, _at: workout?.startedAt };
        }
        if (isLatest) {
          if (est > lastWorkoutBest1rm) lastWorkoutBest1rm = est;
          if (!lastTop) lastTop = { ...s, _at: workout?.startedAt };
        } else {
          if (est > priorBest1rm) priorBest1rm = est;
        }
      }
    }

    const isNewPR = lastWorkoutBest1rm > 0 && lastWorkoutBest1rm > priorBest1rm;
    return { best1rm, bestSet, lastTop, isNewPR };
  }, [history]);

  const suggestedNext = useMemo(() => {
    if (!best.lastTop) return null;
    const w = Number(best.lastTop.weightKg) || 0;
    const r = Number(best.lastTop.reps) || 0;
    if (w <= 0 || r <= 0) return null;
    const nextW = r <= 10
      ? roundToStep(w + 2.5, 2.5)
      : roundToStep(w * 1.05, 2.5);
    return { weightKg: nextW, reps: r };
  }, [best.lastTop]);

  const muscleLabels = useMemo(() => {
    const ids = ex?.muscles?.primary || [];
    return ids.map((id) => musclesUk?.[id] || id).filter(Boolean);
  }, [ex, musclesUk]);

  const progressData = useMemo(() => {
    const byWeek = new Map();
    for (const { workout, item } of history) {
      if (item?.type !== "strength" || !workout?.startedAt) continue;
      const d = new Date(workout.startedAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString().slice(0, 10);
      const sets = item.sets || [];
      let maxRm = 0;
      let vol = 0;
      for (const s of sets) {
        const rm = epley1rm(s.weightKg, s.reps);
        if (rm > maxRm) maxRm = rm;
        vol += (Number(s.weightKg) || 0) * (Number(s.reps) || 0);
      }
      const existing = byWeek.get(key) || { maxRm: 0, vol: 0, date: weekStart };
      byWeek.set(key, {
        maxRm: Math.max(existing.maxRm, maxRm),
        vol: existing.vol + vol,
        date: existing.date,
      });
    }

    const sorted = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);

    const rmPoints = sorted.map(([, v]) => ({
      value: Math.round(v.maxRm),
      dateLabel: v.date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" }),
    }));
    const volPoints = sorted.map(([, v]) => ({
      value: Math.round(v.vol),
      dateLabel: v.date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" }),
    }));
    return { rmPoints, volPoints };
  }, [history]);

  if (!exerciseId) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card text-sm text-subtle">
            Невірний ID вправи
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-3">
        <section
          className="rounded-3xl p-5 border border-line/20 bg-forest-grad"
          aria-label="Профіль вправи"
        >
          <p className="text-[11px] font-bold tracking-widest uppercase text-accent">
            Профіль вправи
          </p>
          <h1 className="text-2xl font-black text-white mt-2 leading-tight">
            {ex?.name?.uk ||
              ex?.name?.en ||
              history?.[0]?.item?.nameUk ||
              "Вправа"}
          </h1>
          {muscleLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {muscleLabels.map((m) => (
                <span
                  key={m}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/15 text-white/80 border border-white/20"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
          {muscleLabels.length === 0 && (
            <p className="text-xs text-white/50 mt-2">
              Додай мʼязи в каталозі для точнішої аналітики
            </p>
          )}
        </section>

        {best.isNewPR && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3">
            <span className="text-xl leading-none">🏆</span>
            <div>
              <p className="text-sm font-bold text-yellow-700 dark:text-yellow-300">Новий особистий рекорд!</p>
              <p className="text-xs text-yellow-600/80 dark:text-yellow-400/70">Найкращий результат за всю історію</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
              Особистий рекорд
            </div>
            <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">
              {best.best1rm ? `${fmt(best.best1rm, 0)} кг` : "—"}
            </div>
            <div className="text-xs text-subtle mt-1">
              {best.bestSet
                ? `${best.bestSet.weightKg ?? 0} × ${best.bestSet.reps ?? 0} повт.`
                : "Немає силових сетів"}
            </div>
            {best.bestSet?._at && (
              <div className="text-[10px] text-subtle/70 mt-1">
                {new Date(best.bestSet._at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "2-digit" })}
              </div>
            )}
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
              Наступного разу
            </div>
            <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">
              {suggestedNext ? `${fmt(suggestedNext.weightKg, 1)} кг` : "—"}
            </div>
            <div className="text-xs text-subtle mt-1">
              {suggestedNext
                ? `× ${suggestedNext.reps} повт.`
                : "Заповни сети, щоб зʼявилась рекомендація"}
            </div>
            {suggestedNext && best.lastTop && (
              <div className="text-[10px] text-subtle/70 mt-1">
                {`зараз: ${best.lastTop.weightKg ?? 0} × ${best.lastTop.reps ?? 0}`}
              </div>
            )}
          </div>
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
            Прогресія 1RM (за тижнями)
          </div>
          <ProgressChart
            points={progressData.rmPoints}
            label="1RM"
            unit="кг"
            color="rgb(22 163 74)"
          />
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
            Обʼєм тренування (кг × повтори, за тижнями)
          </div>
          <ProgressChart
            points={progressData.volPoints}
            label="Обсяг"
            unit="кг"
            color="rgb(99 102 241)"
          />
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
            Історія сетів
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-subtle text-center py-6">
              Ще немає записів по цій вправі
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 20).map(({ workout, item }) => (
                <div
                  key={`${workout.id}_${item.id}`}
                  className="border border-line rounded-2xl p-3 bg-bg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-subtle">
                      {workout?.startedAt
                        ? new Date(workout.startedAt).toLocaleDateString(
                            "uk-UA",
                            { month: "short", day: "numeric", year: "2-digit" },
                          )
                        : "—"}
                    </div>
                    <div
                      className={cn(
                        "text-[10px] px-2 py-1 rounded-full border",
                        item.type === "strength"
                          ? "border-line text-subtle"
                          : "border-line text-subtle",
                      )}
                    >
                      {item.type === "strength"
                        ? "силова"
                        : item.type === "distance"
                          ? "дистанція"
                          : "час"}
                    </div>
                  </div>
                  <div className="text-sm text-text mt-2">
                    {item.type === "strength"
                      ? (item.sets || [])
                          .map((s) => `${s.weightKg ?? 0}×${s.reps ?? 0}`)
                          .join(", ") || "—"
                      : item.type === "distance"
                        ? `${item.distanceM ?? 0} м за ${item.durationSec ?? 0} с`
                        : `${item.durationSec ?? 0} с`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              className="w-full py-4 rounded-full font-bold text-[15px] bg-accent text-forest"
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
