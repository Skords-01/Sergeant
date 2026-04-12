import { useMemo, useRef } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useMeasurements } from "../hooks/useMeasurements";
import { useWorkouts } from "../hooks/useWorkouts";

const WORKOUTS_KEY = "fizruk_workouts_v1";
const MEASUREMENTS_KEY = "fizruk_measurements_v1";
const CUSTOM_EX_KEY = "fizruk_custom_exercises_v1";
const TEMPLATES_KEY = "fizruk_workout_templates_v1";
const SELECTED_TEMPLATE_KEY = "fizruk_selected_template_id_v1";

function epley1rm(weightKg, reps) {
  const w = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + (r / 30));
}

function weekStartMs(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

export function Progress() {
  const { workouts } = useWorkouts();
  const { entries } = useMeasurements();
  const { exercises, musclesUk } = useExerciseCatalog();
  const fileRef = useRef(null);

  const meas = useMemo(() => {
    const latest = entries?.[0] || null;
    const prev = entries?.[1] || null;
    const delta = (field) => {
      const a = Number(latest?.[field]);
      const b = Number(prev?.[field]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return a - b;
    };
    return { latest, prev, delta };
  }, [entries]);

  const weeklyByMuscle = useMemo(() => {
    const now = Date.now();
    const weeks = new Map(); // weekStartMs -> { muscleId -> tonnagePoints }
    const DAY = 24 * 60 * 60 * 1000;
    const cutoff = now - (28 * DAY);

    for (const w of workouts || []) {
      const t = w.startedAt ? Date.parse(w.startedAt) : NaN;
      if (!Number.isFinite(t) || t < cutoff) continue;
      const wk = weekStartMs(t);
      if (!weeks.has(wk)) weeks.set(wk, {});
      const bucket = weeks.get(wk);
      for (const it of w.items || []) {
        const primary = it.musclesPrimary || [];
        const secondary = it.musclesSecondary || [];
        let pts = 0;
        if (it.type === "strength") {
          pts = (it.sets || []).reduce((s, x) => s + (Number(x.weightKg) || 0) * (Number(x.reps) || 0), 0) / 1000;
        } else if (it.type === "time") {
          pts = (Number(it.durationSec) || 0) / 240;
        } else if (it.type === "distance") {
          pts = ((Number(it.distanceM) || 0) / 1000) + ((Number(it.durationSec) || 0) / 60) / 30;
        }
        const add = (id, wgt) => {
          if (!id) return;
          bucket[id] = (bucket[id] || 0) + pts * wgt;
        };
        for (const id of primary) add(id, 1);
        for (const id of secondary) add(id, 0.55);
      }
    }

    const keys = Array.from(weeks.keys()).sort((a, b) => b - a);
    const latestWeek = keys[0] || null;
    const latestData = latestWeek ? weeks.get(latestWeek) : {};
    const top = Object.entries(latestData || {})
      .map(([id, v]) => ({ id, label: musclesUk?.[id] || id, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const max = top[0]?.value || 1;
    return { latestWeek, top, max };
  }, [workouts, musclesUk]);

  const prs = useMemo(() => {
    const by = {};
    for (const w of workouts || []) {
      for (const it of w.items || []) {
        const exId = it.exerciseId;
        if (!exId || it.type !== "strength") continue;
        for (const s of it.sets || []) {
          const est = epley1rm(s.weightKg, s.reps);
          if (!est) continue;
          if (!by[exId] || est > by[exId].best1rm) by[exId] = { best1rm: est, weightKg: s.weightKg, reps: s.reps, at: w.startedAt };
        }
      }
    }
    const labelById = new Map((exercises || []).map(ex => [ex.id, ex?.name?.uk || ex?.name?.en || ex.id]));
    return Object.entries(by)
      .map(([id, v]) => ({ id, name: labelById.get(id) || id, ...v }))
      .sort((a, b) => b.best1rm - a.best1rm)
      .slice(0, 12);
  }, [workouts, exercises]);

  const exportJson = () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        [WORKOUTS_KEY]: localStorage.getItem(WORKOUTS_KEY),
        [MEASUREMENTS_KEY]: localStorage.getItem(MEASUREMENTS_KEY),
        [CUSTOM_EX_KEY]: localStorage.getItem(CUSTOM_EX_KEY),
        [TEMPLATES_KEY]: localStorage.getItem(TEMPLATES_KEY),
        [SELECTED_TEMPLATE_KEY]: localStorage.getItem(SELECTED_TEMPLATE_KEY),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fizruk-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importJson = async (file) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const d = parsed?.data || {};
    for (const k of [WORKOUTS_KEY, MEASUREMENTS_KEY, CUSTOM_EX_KEY, TEMPLATES_KEY, SELECTED_TEMPLATE_KEY]) {
      const v = d[k];
      if (typeof v === "string") localStorage.setItem(k, v);
    }
    window.location.reload();
  };

  const resetAll = () => {
    if (!confirm("Скинути всі дані Фізрука на цьому пристрої?")) return;
    for (const k of [WORKOUTS_KEY, MEASUREMENTS_KEY, CUSTOM_EX_KEY, TEMPLATES_KEY, SELECTED_TEMPLATE_KEY, "fizruk_active_workout_id_v1", "fizruk_plan_template_v1"]) {
      try { localStorage.removeItem(k); } catch {}
    }
    window.location.reload();
  };

  const hasAny = (workouts?.length || 0) > 0 || (entries?.length || 0) > 0;

  const quickStats = useMemo(() => {
    const done = (workouts || []).filter(w => w.endedAt);
    const latestTs = done.reduce((mx, w) => {
      const ts = w.startedAt ? Date.parse(w.startedAt) : NaN;
      return Number.isFinite(ts) ? Math.max(mx, ts) : mx;
    }, 0);
    const latestWorkoutAt = latestTs
      ? new Date(latestTs).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
      : "—";
    return {
      doneCount: done.length,
      prsCount: prs.length,
      latestWorkoutAt,
    };
  }, [workouts, prs.length]);

  const exportCsv = () => {
    const rows = [["startedAt", "endedAt", "workout_id", "exercise", "type", "detail", "energy_1_5", "mood_1_5"]];
    for (const w of workouts || []) {
      const we = w.wellbeing?.energy ?? "";
      const wm = w.wellbeing?.mood ?? "";
      for (const it of w.items || []) {
        let detail = "";
        if (it.type === "strength") detail = (it.sets || []).map(s => `${s.weightKg ?? 0}x${s.reps ?? 0}`).join(";");
        else if (it.type === "distance") detail = `${it.distanceM ?? 0}m/${it.durationSec ?? 0}s`;
        else detail = String(it.durationSec ?? "");
        rows.push([
          w.startedAt || "",
          w.endedAt || "",
          w.id,
          (it.nameUk || "").replace(/"/g, "'"),
          it.type || "",
          detail,
          we,
          wm,
        ]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fizruk-workouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-3">
        <section
          className="rounded-3xl p-4 border border-line/20"
          style={{ background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)" }}
          aria-label="Огляд прогресу"
        >
          <div className="text-[11px] font-bold tracking-widest uppercase text-accent">Прогрес</div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Тренувань</div>
              <div className="text-lg font-black text-white tabular-nums">{workouts.length}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">PR</div>
              <div className="text-lg font-black text-white tabular-nums">{prs.length}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Заміри</div>
              <div className="text-lg font-black text-white tabular-nums">{entries.length}</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Тренувань</div>
            <div className="text-lg font-extrabold text-text tabular-nums mt-1">{quickStats.doneCount}</div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">PR вправ</div>
            <div className="text-lg font-extrabold text-text tabular-nums mt-1">{quickStats.prsCount}</div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Останнє</div>
            <div className="text-sm font-bold text-text mt-1">{quickStats.latestWorkoutAt}</div>
          </div>
        </div>

        {!hasAny && (
          <div className="bg-panel border border-line/60 rounded-2xl p-8 shadow-card text-center">
            <div className="text-3xl mb-3">📈</div>
            <div className="text-sm font-medium text-text mb-1">Даних ще немає</div>
            <div className="text-xs text-subtle">Додай тренування або заміри — і тут зʼявиться аналітика</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Вага</div>
            <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">
              {meas.latest?.weightKg != null ? `${meas.latest.weightKg} кг` : "—"}
            </div>
            <div className="text-xs text-subtle mt-1">
              {meas.delta("weightKg") == null ? "Немає порівняння" : (
                <span className={cn("font-semibold", meas.delta("weightKg") > 0 ? "text-warning" : "text-success")}>
                  {meas.delta("weightKg") > 0 ? "+" : ""}{meas.delta("weightKg").toFixed(1)} кг
                </span>
              )}
            </div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">% жиру</div>
            <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">
              {meas.latest?.bodyFatPct != null ? `${meas.latest.bodyFatPct}%` : "—"}
            </div>
            <div className="text-xs text-subtle mt-1">
              {meas.delta("bodyFatPct") == null ? "—" : (
                <span className={cn("font-semibold", meas.delta("bodyFatPct") > 0 ? "text-warning" : "text-success")}>
                  {meas.delta("bodyFatPct") > 0 ? "+" : ""}{meas.delta("bodyFatPct").toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-medium text-subtle mb-3">Обʼєм по мʼязах (цей тиждень)</div>
          {weeklyByMuscle.top.length === 0 ? (
            <div className="text-sm text-subtle text-center py-6">Немає даних за останні 4 тижні</div>
          ) : (
            <div className="space-y-2">
              {weeklyByMuscle.top.map(m => (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-text truncate">{m.label}</div>
                    <div className="text-xs text-subtle tabular-nums">{m.value.toFixed(1)}</div>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden border border-line">
                    <div className="h-full bg-success/70" style={{ width: `${Math.max(6, (m.value / weeklyByMuscle.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-medium text-subtle mb-3">PR (оцінка 1RM)</div>
          {prs.length === 0 ? (
            <div className="text-sm text-subtle text-center py-6">Поки немає силових PR</div>
          ) : (
            <div className="space-y-2">
              {prs.map(p => (
                <button
                  key={p.id}
                  className="w-full text-left border border-line rounded-2xl p-3 bg-bg hover:bg-panelHi transition-colors"
                  onClick={() => { window.location.hash = `#exercise/${p.id}`; }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text truncate">{p.name}</div>
                    <div className="text-xs text-subtle tabular-nums">{p.best1rm.toFixed(0)} кг</div>
                  </div>
                  <div className="text-xs text-subtle mt-0.5">
                    {p.weightKg ?? 0}×{p.reps ?? 0}{p.at ? ` · ${new Date(p.at).toLocaleDateString("uk-UA", { month: "short", day: "numeric" })}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-medium text-subtle mb-3">Дані</div>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12 min-h-[44px]" onClick={exportJson}>Експорт (backup)</Button>
            <Button className="h-12 min-h-[44px]" variant="ghost" onClick={() => fileRef.current?.click()}>Імпорт</Button>
          </div>
          <Button className="w-full h-12 min-h-[44px] mt-2" variant="ghost" onClick={exportCsv}>
            Експорт тренувань (CSV)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              importJson(f).catch(() => alert("Не вдалося імпортувати файл"));
            }}
          />
          <div className="mt-3">
            <Button variant="danger" className="w-full h-12" onClick={resetAll}>Скинути всі дані</Button>
          </div>
          <div className="text-[11px] text-subtle/70 mt-2">
            Порада: роби експорт перед великими змінами/оновленнями.
          </div>
        </div>
      </div>
    </div>
  );
}
