import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useMeasurements } from "../hooks/useMeasurements";
import { ROUTINE_EVENT } from "../../routine/lib/routineStorage.js";
import { buildPushupHistoryFromRoutine } from "../../routine/lib/routinePushupsRead.js";
import { useWorkouts } from "../hooks/useWorkouts";
import { MiniLineChart } from "../components/MiniLineChart";
import { WellbeingChart } from "../components/WellbeingChart";
import { WeeklyVolumeChart } from "../components/WeeklyVolumeChart";
import {
  applyFizrukFullBackupPayload,
  buildFizrukFullBackupPayload,
  FIZRUK_RESET_KEYS,
} from "../lib/fizrukStorage";
import { weeklyVolumeSeriesNow } from "../lib/workoutStats";

function epley1rm(weightKg, reps) {
  const w = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + (r / 30));
}

function weekStartMs(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

export function Progress() {
  const { workouts } = useWorkouts();
  const { entries } = useMeasurements();
  const { exercises, musclesUk } = useExerciseCatalog();
  const [pushupSync, setPushupSync] = useState(0);
  useEffect(() => {
    const sync = () => setPushupSync((n) => n + 1);
    window.addEventListener(ROUTINE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ROUTINE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const pushupHistory = useMemo(() => {
    void pushupSync;
    return buildPushupHistoryFromRoutine(30);
  }, [pushupSync]);
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

  const weightTrend = useMemo(() => {
    return [...(entries || [])]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-8)
      .map(e => ({
        value: e.weightKg != null && e.weightKg !== "" ? Number(e.weightKg) : null,
        label: new Date(e.at).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }),
      }));
  }, [entries]);

  const fatTrend = useMemo(() => {
    return [...(entries || [])]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-8)
      .map(e => ({
        value: e.bodyFatPct != null && e.bodyFatPct !== "" ? Number(e.bodyFatPct) : null,
        label: new Date(e.at).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }),
      }));
  }, [entries]);

  const weeklyByMuscle = useMemo(() => {
    const now = Date.now();
    const weeks = new Map();
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

  const pushupStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const week = (pushupHistory || []).filter(d => d.date >= weekAgo).reduce((s, d) => s + d.total, 0);
    const month = (pushupHistory || []).filter(d => d.date >= monthAgo).reduce((s, d) => s + d.total, 0);
    const todayCount = (pushupHistory || []).find(d => d.date === today)?.total ?? 0;
    return { todayCount, week, month };
  }, [pushupHistory]);

  const weekly = useMemo(() => weeklyVolumeSeriesNow(workouts), [workouts]);

  const wellbeingData = useMemo(() => {
    return (workouts || [])
      .filter(w => w.endedAt && (w.wellbeing?.energy != null || w.wellbeing?.mood != null))
      .slice(0, 14)
      .reverse()
      .map(w => ({
        label: new Date(w.startedAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }),
        energy: w.wellbeing?.energy ?? null,
        mood: w.wellbeing?.mood ?? null,
      }));
  }, [workouts]);

  const exportJson = () => {
    const payload = buildFizrukFullBackupPayload();
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
    applyFizrukFullBackupPayload(parsed);
    window.location.reload();
  };

  const resetAll = () => {
    if (!confirm("Скинути всі дані Фізрука на цьому пристрої?")) return;
    for (const k of FIZRUK_RESET_KEYS) {
      try { localStorage.removeItem(k); } catch {}
    }
    window.location.reload();
  };

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

  const hasAny = (workouts?.length || 0) > 0 || (entries?.length || 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 fizruk-page-scroll-pad space-y-3">

        {/* Hero */}
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

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Завершено</div>
            <div className="text-lg font-extrabold text-text tabular-nums mt-1">{quickStats.doneCount}</div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">PR вправ</div>
            <div className="text-lg font-extrabold text-text tabular-nums mt-1">{quickStats.prsCount}</div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Останнє</div>
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

        {/* Weekly volume chart */}
        {(workouts || []).some(w => w.endedAt) && (
          <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
            <WeeklyVolumeChart volumeKg={weekly.volumeKg} />
          </div>
        )}

        {/* Pushup stats */}
        {(pushupStats.todayCount > 0 || pushupStats.week > 0 || pushupStats.month > 0) && (
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Відтискання</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-bg border border-line rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-subtle uppercase tracking-wide">Сьогодні</div>
                <div className="text-lg font-black text-text tabular-nums">{pushupStats.todayCount}</div>
              </div>
              <div className="bg-bg border border-line rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-subtle uppercase tracking-wide">Тиждень</div>
                <div className="text-lg font-black text-text tabular-nums">{pushupStats.week}</div>
              </div>
              <div className="bg-bg border border-line rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-subtle uppercase tracking-wide">Місяць</div>
                <div className="text-lg font-black text-text tabular-nums">{pushupStats.month}</div>
              </div>
            </div>
            <p className="text-[10px] text-subtle mt-3">Облік у модулі «Рутина».</p>
          </div>
        )}

        {/* Weight + fat cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Вага</div>
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
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">% жиру</div>
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

        {/* Weight trend chart */}
        {weightTrend.filter(d => d.value != null).length >= 2 && (
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Тренд ваги</div>
            <MiniLineChart data={weightTrend} unit="кг" color="rgb(22 163 74)" metricLabel="вагу тіла" />
          </div>
        )}

        {/* Body fat trend chart */}
        {fatTrend.filter(d => d.value != null).length >= 2 && (
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Тренд % жиру</div>
            <MiniLineChart data={fatTrend} unit="%" color="rgb(234 179 8)" metricLabel="відсоток жиру" />
          </div>
        )}

        {/* Wellbeing chart */}
        {wellbeingData.length >= 2 && (
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Самопочуття</div>
            <WellbeingChart data={wellbeingData} />
          </div>
        )}

        {/* Muscle volume bars */}
        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Обʼєм по мʼязах</div>
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

        {/* PR list */}
        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Рекорди (PR)</div>
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

        {/* Data management */}
        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Дані</div>
          <button
            type="button"
            className="w-full py-4 rounded-full font-bold text-[15px] bg-accent mb-2 transition-all active:scale-[0.98]"
            style={{ color: "#0f2d1a" }}
            onClick={exportJson}
          >
            Експорт (backup)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12 min-h-[44px] rounded-full" variant="ghost" onClick={() => fileRef.current?.click()}>Імпорт</Button>
            <Button className="h-12 min-h-[44px] rounded-full" variant="ghost" onClick={exportCsv}>CSV</Button>
          </div>
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
