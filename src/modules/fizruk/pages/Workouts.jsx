import { useEffect, useMemo, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { WorkoutTemplatesSection } from "../components/WorkoutTemplatesSection";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useWorkouts } from "../hooks/useWorkouts";
import { recoveryConflictsForExercise, recoveryConflictsForWorkoutItem } from "../lib/recoveryConflict";

const ACTIVE_WORKOUT_KEY = "fizruk_active_workout_id_v1";
const SHEET_BOTTOM_PADDING = "calc(env(safe-area-inset-bottom, 16px) + 72px)";
const SHEET_Z = "z-[100]";

const EQUIPMENT_OPTIONS = [
  { id: "bodyweight", label: "Власна вага" },
  { id: "barbell", label: "Штанга" },
  { id: "dumbbell", label: "Гантелі" },
  { id: "kettlebell", label: "Гиря" },
  { id: "cable", label: "Блок/трос" },
  { id: "machine", label: "Тренажер" },
  { id: "band", label: "Еспандер/резинка" },
  { id: "bench", label: "Лава" },
  { id: "other", label: "Інше" },
];

function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toggleArr(arr, value) {
  const a = Array.isArray(arr) ? arr : [];
  return a.includes(value) ? a.filter(x => x !== value) : [...a, value];
}

function summarizeWorkoutForFinish(w) {
  if (!w?.startedAt) return null;
  const start = Date.parse(w.startedAt);
  const end = Date.now();
  if (!Number.isFinite(start)) return null;
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

function formatDurShort(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s} с`;
  return `${m} хв ${s} с`;
}

function formatRestClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function mondayStartMs(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

export function Workouts() {
  const { exercises, search, primaryGroupsUk, musclesUk, musclesByPrimaryGroup, addExercise, removeExercise } = useExerciseCatalog();
  const rec = useRecovery();
  const { workouts, createWorkout, deleteWorkout, endWorkout, addItem, updateItem, removeItem } = useWorkouts();
  const templateApi = useWorkoutTemplates();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(() => ({}));
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState("catalog"); // catalog | log | templates
  const [restTimer, setRestTimer] = useState(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_WORKOUT_KEY) || null; } catch { return null; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickQ, setPickQ] = useState("");
  const [pendingPick, setPendingPick] = useState(null);
  const [finishFlash, setFinishFlash] = useState(null);
  const [journalLimit, setJournalLimit] = useState(12);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState(() => ({
    nameUk: "",
    primaryGroup: "chest",
    musclesPrimary: [],
    musclesSecondary: [],
    equipment: ["bodyweight"],
    description: "",
  }));
  const suggestedMuscles = useMemo(() => {
    const g = form.primaryGroup;
    const ids = musclesByPrimaryGroup?.[g] || [];
    // show only known labels first
    return ids.filter(id => musclesUk?.[id]);
  }, [form.primaryGroup, musclesByPrimaryGroup, musclesUk]);
  const list = useMemo(() => search(q), [search, q]);
  const pickList = useMemo(() => search(pickQ).slice(0, 60), [search, pickQ]);
  const pickGrouped = useMemo(() => {
    const m = new Map();
    for (const ex of pickList) {
      const gid = ex.primaryGroup || "full_body";
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(ex);
    }
    const order = ["chest", "back", "shoulders", "arms", "core", "legs", "glutes", "full_body", "cardio"];
    return Array.from(m.entries())
      .sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
      .map(([gid, items]) => ({ id: gid, label: primaryGroupsUk[gid] || gid, items }));
  }, [pickList, primaryGroupsUk]);
  const activeWorkout = workouts.find(w => w.id === activeWorkoutId) || null;
  const workoutQuickStats = useMemo(() => {
    const done = (workouts || []).filter(w => w.endedAt);
    const weekStart = mondayStartMs(Date.now());
    const thisWeekDone = done.filter(w => {
      const ts = w.startedAt ? Date.parse(w.startedAt) : NaN;
      return Number.isFinite(ts) && ts >= weekStart;
    }).length;
    const activeItems = (activeWorkout?.items || []).length;
    return {
      doneCount: done.length,
      thisWeekDone,
      activeItems,
    };
  }, [workouts, activeWorkout]);

  const activeDuration = useMemo(() => {
    if (!activeWorkout?.startedAt) return null;
    const start = Date.parse(activeWorkout.startedAt);
    const end = activeWorkout.endedAt ? Date.parse(activeWorkout.endedAt) : now;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const sec = Math.floor((end - start) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [activeWorkout?.startedAt, activeWorkout?.endedAt, now]);

  useEffect(() => {
    try {
      if (!activeWorkoutId) localStorage.removeItem(ACTIVE_WORKOUT_KEY);
      else localStorage.setItem(ACTIVE_WORKOUT_KEY, activeWorkoutId);
    } catch {}
  }, [activeWorkoutId]);

  useEffect(() => {
    try {
      const m = sessionStorage.getItem("fizruk_workouts_mode");
      if (m === "templates") {
        setMode("templates");
        sessionStorage.removeItem("fizruk_workouts_mode");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) return;
    const id = setInterval(() => {
      setRestTimer(r => {
        if (!r || r.remaining <= 1) {
          try { navigator.vibrate?.(200); } catch {}
          return null;
        }
        return { ...r, remaining: r.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [restTimer]);

  useEffect(() => {
    if (!pickerOpen) setPendingPick(null);
  }, [pickerOpen]);

  // Live timer tick — only when there is an active, unfinished workout
  useEffect(() => {
    if (!activeWorkout || activeWorkout.endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeWorkout?.id, activeWorkout?.endedAt]);

  const addExerciseToActive = (ex) => {
    if (!activeWorkoutId) return;
    const isCardio = ex.primaryGroup === "cardio";
    addItem(activeWorkoutId, {
      exerciseId: ex.id,
      nameUk: ex?.name?.uk || ex?.name?.en,
      primaryGroup: ex.primaryGroup,
      musclesPrimary: ex?.muscles?.primary || [],
      musclesSecondary: ex?.muscles?.secondary || [],
      type: isCardio ? "distance" : "strength",
      sets: isCardio ? undefined : [{ weightKg: 0, reps: 0 }],
      durationSec: isCardio ? 0 : 0,
      distanceM: isCardio ? 0 : 0,
    });
    setPickerOpen(false);
    setPickQ("");
    setPendingPick(null);
  };

  const lastByExerciseId = useMemo(() => {
    const out = {};
    for (const w of workouts || []) {
      if (w.id === activeWorkoutId) continue;
      for (const it of w.items || []) {
        const exId = it.exerciseId;
        if (!exId) continue;
        const existing = out[exId];
        if (!existing || (w.startedAt || "").localeCompare(existing._startedAt || "") > 0) {
          out[exId] = { ...it, _startedAt: w.startedAt };
        }
      }
    }
    return out;
  }, [workouts, activeWorkoutId]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const ex of list) {
      const gid = ex.primaryGroup || "full_body";
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(ex);
    }
    // stable group order (common first)
    const order = ["chest", "back", "shoulders", "arms", "core", "legs", "glutes", "full_body", "cardio"];
    const entries = Array.from(m.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a[0].localeCompare(b[0]);
    });
    return entries.map(([gid, items]) => ({
      id: gid,
      label: primaryGroupsUk[gid] || gid,
      items: items.slice(0, 80),
      total: items.length,
    }));
  }, [list, primaryGroupsUk]);

  const finishedCount = useMemo(() => (workouts || []).filter(w => w.endedAt).length, [workouts]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
        <section
          className="rounded-3xl p-4 mb-3 border border-line/20"
          style={{ background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)" }}
          aria-label="Огляд тренувань"
        >
          <div className="text-[11px] font-bold tracking-widest uppercase text-accent">Тренування</div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Всього</div>
              <div className="text-lg font-black text-white tabular-nums">{workouts.length}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Завершено</div>
              <div className="text-lg font-black text-white tabular-nums">{finishedCount}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Активне</div>
              <div className="text-lg font-black text-white tabular-nums">{activeWorkout ? 1 : 0}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn("text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors", mode === "catalog" ? "bg-forest text-white border-forest" : "border-line text-subtle hover:text-text")}
              onClick={() => setMode("catalog")}
              aria-pressed={mode === "catalog"}
            >
              Каталог
            </button>
            <button
              type="button"
              className={cn("text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors", mode === "log" ? "bg-forest text-white border-forest" : "border-line text-subtle hover:text-text")}
              onClick={() => setMode("log")}
              aria-pressed={mode === "log"}
            >
              Журнал
            </button>
            <button
              type="button"
              className={cn("text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors", mode === "templates" ? "bg-forest text-white border-forest" : "border-line text-subtle hover:text-text")}
              onClick={() => setMode("templates")}
              aria-pressed={mode === "templates"}
            >
              Шаблони
            </button>
            {mode === "catalog" && (
              <Button size="sm" className="h-9 min-h-[44px] px-4" onClick={() => setAddOpen(true)} aria-label="Додати вправу в каталог">
                + Додати
              </Button>
            )}
          </div>
        </div>

        {mode === "log" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
                <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Завершено</div>
                <div className="text-lg font-extrabold text-text tabular-nums mt-1">{workoutQuickStats.doneCount}</div>
              </div>
              <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
                <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Цей тиждень</div>
                <div className="text-lg font-extrabold text-text tabular-nums mt-1">{workoutQuickStats.thisWeekDone}</div>
              </div>
              <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
                <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">В активному</div>
                <div className="text-lg font-extrabold text-text tabular-nums mt-1">{workoutQuickStats.activeItems}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-3.5 rounded-full font-bold text-[15px] bg-accent transition-all active:scale-[0.98]"
                style={{ color: "#0f2d1a" }}
                onClick={() => {
                  const w = createWorkout();
                  setActiveWorkoutId(w.id);
                }}
              >
                + Нове тренування
              </button>
              <Button
                variant="ghost"
                className="h-[52px] px-4 rounded-full"
                onClick={() => setPickerOpen(true)}
                disabled={!activeWorkoutId}
              >
                + Вправа
              </Button>
            </div>

            {!activeWorkout && (
              <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card text-center">
                <div className="text-sm font-semibold text-text">Немає активного тренування</div>
                <div className="text-xs text-subtle mt-1">Створи нове або запусти готовий шаблон</div>
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1 h-11"
                    onClick={() => {
                      const w = createWorkout();
                      setActiveWorkoutId(w.id);
                    }}
                  >
                    + Нове
                  </Button>
                  <Button variant="ghost" className="flex-1 h-11" onClick={() => setMode("templates")}>
                    Шаблони
                  </Button>
                </div>
              </div>
            )}

            {activeWorkout && (
              <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-text">Активне тренування</div>
                    <div className="text-xs text-subtle mt-0.5">
                      {new Date(activeWorkout.startedAt).toLocaleString("uk-UA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {activeDuration ? <span className="ml-2">· {activeDuration}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!activeWorkout.endedAt ? (
                      <Button
                        size="sm"
                        className="h-9 px-4"
                        onClick={() => {
                          const sum = summarizeWorkoutForFinish(activeWorkout);
                          const wid = activeWorkout.id;
                          endWorkout(wid);
                          if (sum) {
                            setFinishFlash({
                              step: "wellbeing",
                              collapsed: false,
                              ...sum,
                              workoutId: wid,
                              energy: null,
                              mood: null,
                            });
                          }
                        }}
                      >
                        Завершити
                      </Button>
                    ) : (
                      <span className="text-xs text-subtle">Завершено</span>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      className="h-9 px-4"
                      onClick={() => {
                        if (confirm("Видалити тренування?")) {
                          deleteWorkout(activeWorkout.id);
                          setActiveWorkoutId(prev => (prev === activeWorkout.id ? null : prev));
                        }
                      }}
                    >
                      Видалити
                    </Button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {(activeWorkout.items || []).length === 0 ? (
                    <div className="text-sm text-subtle text-center py-6">Додай вправи, щоб почати логувати</div>
                  ) : (
                    (activeWorkout.items || []).map((it) => (
                      <div key={it.id} className="border border-line rounded-2xl p-3 bg-bg">
                        {it.exerciseId && lastByExerciseId[it.exerciseId] && (
                          <div className="text-[11px] text-subtle/70 mb-1">
                            Минулого разу{" "}
                            {lastByExerciseId[it.exerciseId]._startedAt
                              ? `(${new Date(lastByExerciseId[it.exerciseId]._startedAt).toLocaleDateString("uk-UA", { month: "short", day: "numeric" })})`
                              : ""}:
                            {" "}
                            {lastByExerciseId[it.exerciseId].type === "strength"
                              ? (lastByExerciseId[it.exerciseId].sets || []).map(s => `${s.weightKg ?? 0}×${s.reps ?? 0}`).slice(0, 3).join(", ")
                              : lastByExerciseId[it.exerciseId].type === "distance"
                                ? `${lastByExerciseId[it.exerciseId].distanceM ?? 0}м за ${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`
                                : `${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`
                            }
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              className="text-sm font-semibold text-text truncate text-left hover:underline"
                              onClick={() => {
                                if (it.exerciseId) window.location.hash = `#exercise/${it.exerciseId}`;
                              }}
                            >
                              {it.nameUk}
                            </button>
                            <div className="text-xs text-subtle mt-0.5">
                              Мʼязи: <span className="font-semibold text-muted">{(it.musclesPrimary || []).map(id => musclesUk?.[id] || id).join(", ") || "—"}</span>
                            </div>
                            {(() => {
                              const cf = recoveryConflictsForWorkoutItem(it, rec.by);
                              if (!cf.hasWarning) return null;
                              const redL = cf.red.map(x => x.label).join(", ");
                              const yelL = cf.yellow.map(x => x.label).join(", ");
                              return (
                                <div className="text-[11px] mt-1.5 rounded-xl border border-warning/40 bg-warning/10 px-2 py-1.5 text-warning leading-snug">
                                  {cf.red.length ? <>Рано навантажувати: <span className="font-semibold">{redL}</span>. </> : null}
                                  {cf.yellow.length ? <>Краще почекати: <span className="font-semibold">{yelL}</span>.</> : null}
                                </div>
                              );
                            })()}
                          </div>
                          <button
                            className="text-xs text-danger/80 hover:text-danger"
                            onClick={() => removeItem(activeWorkout.id, it.id)}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-2">
                          <div className="rounded-2xl border border-line bg-panelHi px-3">
                            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Тип</div>
                            <select
                              className="w-full h-10 bg-transparent text-sm text-text outline-none"
                              value={it.type || "strength"}
                              onChange={(e) => {
                                const t = e.target.value;
                                if (t === "strength") updateItem(activeWorkout.id, it.id, { type: t, sets: it.sets?.length ? it.sets : [{ weightKg: 0, reps: 0 }], durationSec: undefined, distanceM: undefined });
                                if (t === "time") updateItem(activeWorkout.id, it.id, { type: t, durationSec: it.durationSec ?? 0, sets: undefined, distanceM: undefined });
                                if (t === "distance") updateItem(activeWorkout.id, it.id, { type: t, distanceM: it.distanceM ?? 0, durationSec: it.durationSec ?? 0, sets: undefined });
                              }}
                            >
                              <option value="strength">Силова (кг × повтори × підходи)</option>
                              <option value="time">Час (секунди)</option>
                              <option value="distance">Дистанція (метри) + час</option>
                            </select>
                          </div>
                        </div>

                        {it.type === "strength" && (
                          <div className="mt-2 space-y-2">
                            {(it.sets || []).map((s, idx) => (
                              <div key={idx} className="grid grid-cols-3 gap-2">
                                <input
                                  className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="кг"
                                  value={s.weightKg || ""}
                                  onFocus={e => e.target.select()}
                                  onChange={(e) => {
                                    const next = [...(it.sets || [])];
                                    next[idx] = { ...next[idx], weightKg: e.target.value === "" ? 0 : Number(e.target.value) };
                                    updateItem(activeWorkout.id, it.id, { sets: next });
                                  }}
                                />
                                <input
                                  className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                                  type="number"
                                  inputMode="numeric"
                                  placeholder="повт."
                                  value={s.reps || ""}
                                  onFocus={e => e.target.select()}
                                  onChange={(e) => {
                                    const next = [...(it.sets || [])];
                                    next[idx] = { ...next[idx], reps: e.target.value === "" ? 0 : Number(e.target.value) };
                                    updateItem(activeWorkout.id, it.id, { sets: next });
                                  }}
                                />
                                <button
                                  className="h-10 rounded-xl border border-line text-xs text-subtle hover:text-danger hover:border-danger/40 transition-colors"
                                  onClick={() => {
                                    const next = (it.sets || []).filter((_, i) => i !== idx);
                                    updateItem(activeWorkout.id, it.id, { sets: next });
                                  }}
                                >
                                  Видалити
                                </button>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              className="w-full h-10 min-h-[44px]"
                              onClick={() => updateItem(activeWorkout.id, it.id, { sets: [...(it.sets || []), { weightKg: 0, reps: 0 }] })}
                            >
                              + Підхід
                            </Button>
                            {!activeWorkout.endedAt && (
                              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-line/60">
                                <span className="text-[10px] font-bold text-subtle uppercase tracking-widest w-full">Таймер відпочинку</span>
                                {[60, 90, 120].map(sec => (
                                  <button
                                    key={sec}
                                    type="button"
                                    className="min-h-[44px] px-4 rounded-xl border border-line bg-panelHi text-sm text-text hover:bg-panel transition-colors"
                                    onClick={() => setRestTimer({ remaining: sec, total: sec })}
                                  >
                                    {sec} с
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {it.type === "time" && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input
                              className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                              type="number"
                              inputMode="numeric"
                              placeholder="сек"
                              value={it.durationSec || ""}
                              onFocus={e => e.target.select()}
                              onChange={(e) => updateItem(activeWorkout.id, it.id, { durationSec: e.target.value === "" ? 0 : Number(e.target.value) })}
                            />
                            <div className="h-10 rounded-xl border border-line bg-bg px-3 text-xs text-subtle flex items-center">
                              Напр: планка, ізометрія
                            </div>
                          </div>
                        )}

                        {it.type === "distance" && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input
                              className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                              type="number"
                              inputMode="numeric"
                              placeholder="метри"
                              value={it.distanceM || ""}
                              onFocus={e => e.target.select()}
                              onChange={(e) => updateItem(activeWorkout.id, it.id, { distanceM: e.target.value === "" ? 0 : Number(e.target.value) })}
                            />
                            <input
                              className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                              type="number"
                              inputMode="numeric"
                              placeholder="сек"
                              value={it.durationSec || ""}
                              onFocus={e => e.target.select()}
                              onChange={(e) => updateItem(activeWorkout.id, it.id, { durationSec: e.target.value === "" ? 0 : Number(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {!activeWorkout.endedAt && (
                  <div className="mt-3">
                    <textarea
                      className="w-full min-h-[72px] rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-muted transition-colors resize-none"
                      placeholder="Нотатки до тренування (необов'язково)…"
                      value={activeWorkout.note || ""}
                      onChange={e => updateWorkout(activeWorkout.id, { note: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
              <div className="px-4 py-3 bg-panelHi/60 border-b border-line">
                <div className="text-xs font-bold text-subtle uppercase tracking-widest">Останні тренування</div>
              </div>
              {(workouts || []).slice(0, journalLimit).map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveWorkoutId(w.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                    activeWorkoutId === w.id && "bg-text/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">
                      {new Date(w.startedAt).toLocaleDateString("uk-UA", { month: "short", day: "numeric" })}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-subtle">{(w.items || []).length} вправ</span>
                      {activeWorkoutId === w.id ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20">Активне</span>
                      ) : w.endedAt ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-panelHi text-subtle border border-line">Завершене</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">Чернетка</span>
                      )}
                    </div>
                  </div>
                  {w.note && (
                    <div className="text-xs text-subtle mt-1 italic line-clamp-2">{w.note}</div>
                  )}
                </button>
              ))}
              {(workouts || []).length > journalLimit && (
                <button
                  onClick={() => setJournalLimit(l => l + 12)}
                  className="w-full py-3 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  Показати більше
                </button>
              )}
              {(workouts || []).length === 0 && (
                <div className="p-6 text-center text-sm text-subtle">Поки тренувань немає</div>
              )}
            </div>
          </div>
        )}

        {mode === "templates" && (
          <WorkoutTemplatesSection
            exercises={exercises}
            search={search}
            templates={templateApi.templates}
            addTemplate={templateApi.addTemplate}
            updateTemplate={templateApi.updateTemplate}
            removeTemplate={templateApi.removeTemplate}
          />
        )}

        {mode === "catalog" && (
        <div className="relative mb-3">
          <Input
            placeholder="Пошук (жим, підтягування, спина...)"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-text"
            >
              ✕
            </button>
          )}
        </div>
        )}

        <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
          {grouped.length === 0 ? (
            <div className="p-6 text-center text-sm text-subtle">
              Поки немає вправ. Додай першу через кнопку “+ Додати”.
            </div>
          ) : (
            grouped.map(g => {
              const isOpen = open[g.id] ?? true;
              return (
                <div key={g.id} className="border-b border-line last:border-0">
                  <button
                    onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-panelHi/60 hover:bg-panelHi transition-colors"
                  >
                    <div className="text-sm font-bold text-text">{g.label}</div>
                    <div className="text-xs text-muted flex items-center gap-2">
                      <span>{g.total}</span>
                      <span className="text-lg leading-none">{isOpen ? "▾" : "▸"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div>
                      {g.items.map(ex => {
                        const catCf = recoveryConflictsForExercise(ex, rec.by);
                        return (
                        <button
                          key={ex.id}
                          onClick={() => setSelected(ex)}
                          className="w-full text-left px-4 py-3 border-t border-line hover:bg-panelHi transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-text truncate flex items-center gap-2">
                                {ex?.name?.uk || ex?.name?.en}
                                {catCf.hasWarning ? <span className="text-warning shrink-0" title="Мʼязи ще відновлюються">⚠</span> : null}
                              </div>
                              <div className="text-xs text-subtle mt-0.5">
                                Мʼязи:{" "}
                                <span className="font-semibold text-muted">
                                  {(ex?.muscles?.primary || []).map(id => musclesUk?.[id] || id).join(", ") || "—"}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted">
                              {ex.rating ? ex.rating.toFixed(1) : ""}
                            </div>
                          </div>
                        </button>
                      );})}
                      {g.total > g.items.length && (
                        <div className="px-4 py-3 text-xs text-subtle border-t border-line">
                          Показано {g.items.length} з {g.total} (уточни пошук щоб звузити)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Details sheet */}
        {selected && (
          <div className={cn("fixed inset-0 flex items-end", SHEET_Z)} onClick={() => setSelected(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft"
              style={{ paddingBottom: SHEET_BOTTOM_PADDING }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-line rounded-full" />
              </div>
              <div className="px-5 pb-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold text-text leading-tight">{selected?.name?.uk || selected?.name?.en}</div>
                    <div className="text-xs text-subtle mt-1">
                      Основна група: <span className="font-semibold text-muted">{selected.primaryGroupUk || selected.primaryGroup}</span>
                      {selected.level ? <> · рівень: <span className="font-semibold text-muted">{selected.level}</span></> : null}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {(() => {
                  const cf = recoveryConflictsForExercise(selected, rec.by);
                  if (!cf.hasWarning) return null;
                  return (
                    <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning leading-snug">
                      {cf.red.length ? <div><span className="font-semibold">Рано:</span> {cf.red.map(x => x.label).join(", ")}</div> : null}
                      {cf.yellow.length ? <div className="mt-1"><span className="font-semibold">Краще почекати:</span> {cf.yellow.map(x => x.label).join(", ")}</div> : null}
                    </div>
                  );
                })()}

                {((selected.images || []).filter(Boolean).length) > 0 && (
                  <div className="mb-4 -mx-5 px-5 overflow-x-auto no-scrollbar">
                    <div className="flex gap-3">
                      {selected.images.slice(0, 8).map((src) => (
                        <img
                          key={src}
                          src={src}
                          alt={selected?.name?.uk || selected?.name?.en || "exercise"}
                          loading="lazy"
                          className="h-40 w-40 rounded-2xl object-cover border border-line bg-bg"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selected.description && (
                  <div className="text-sm text-text leading-relaxed mb-4">
                    {selected.description}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold text-subtle uppercase tracking-widest">Мʼязи</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected?.muscles?.primary || []).map(m => (
                      <span key={m} className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold">
                        {musclesUk?.[m] || m} · основний
                      </span>
                    ))}
                    {(selected?.muscles?.secondary || []).map(m => (
                      <span key={m} className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-subtle font-semibold">
                        {musclesUk?.[m] || m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-subtle uppercase tracking-widest">Обладнання</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.equipmentUk || selected.equipment || []).map(eq => (
                      <span key={eq} className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                {selected.tips?.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-2">Підказки</div>
                    <ul className="space-y-1.5">
                      {selected.tips.map((t, i) => (
                        <li key={i} className="text-sm text-text leading-relaxed">
                          <span className="text-muted font-bold mr-2">•</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(selected._custom || selected.source === "manual" || String(selected.id || "").startsWith("custom_")) && (
                  <div className="mt-4">
                    <Button
                      variant="danger"
                      className="w-full h-12"
                      onClick={() => {
                        if (!confirm("Видалити цю вправу з каталогу?")) return;
                        if (removeExercise(selected.id)) setSelected(null);
                      }}
                    >
                      Видалити з каталогу
                    </Button>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button className="h-12" onClick={() => setSelected(null)}>
                    Готово
                  </Button>
                  <Button
                    variant="ghost"
                    className={cn("h-12")}
                    onClick={() => {
                      navigator.clipboard?.writeText(selected?.name?.uk || selected?.name?.en || "").catch(() => {});
                    }}
                  >
                    📋 Копіювати назву
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add exercise sheet */}
        {addOpen && (
          <div className={cn("fixed inset-0 flex items-end", SHEET_Z)} onClick={() => setAddOpen(false)} role="presentation">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[92dvh] flex flex-col"
              style={{ paddingBottom: SHEET_BOTTOM_PADDING }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-ex-title"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
              </div>
              <div className="px-4 sm:px-5 pb-6 overflow-y-auto flex-1 min-h-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div id="add-ex-title" className="text-lg font-extrabold text-text leading-tight">Додати вправу</div>
                    <div className="text-xs text-subtle mt-1">Збережеться локально на цьому пристрої</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                    aria-label="Закрити форму"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="Назва (укр) *"
                    value={form.nameUk}
                    onChange={e => setForm(f => ({ ...f, nameUk: e.target.value }))}
                    aria-label="Назва вправи українською"
                  />

                  <div className="rounded-2xl border border-line bg-panelHi px-3">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Основна група</div>
                    <select
                      className="w-full min-h-[44px] bg-transparent text-sm text-text outline-none py-2"
                      value={form.primaryGroup}
                      onChange={e => setForm(f => ({ ...f, primaryGroup: e.target.value, musclesPrimary: [], musclesSecondary: [] }))}
                      aria-label="Основна група м’язів"
                    >
                      {Object.keys(primaryGroupsUk).map(id => (
                        <option key={id} value={id}>{primaryGroupsUk[id]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Обладнання</div>
                    <div className="py-2 flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map(o => {
                        const active = (form.equipment || []).includes(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, equipment: toggleArr(f.equipment, o.id) }))}
                            className={cn(
                              "text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors",
                              active ? "bg-text text-white border-text" : "border-line bg-bg text-muted hover:border-muted hover:text-text"
                            )}
                            aria-pressed={active}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Основні мʼязи</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestedMuscles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors",
                            (form.musclesPrimary || []).includes(id)
                              ? "bg-primary border-primary text-white"
                              : "border-line bg-bg text-muted hover:border-muted hover:text-text"
                          )}
                          onClick={() => setForm(f => ({ ...f, musclesPrimary: toggleArr(f.musclesPrimary, id) }))}
                        >
                          {musclesUk[id] || id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Супутні мʼязи</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestedMuscles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors",
                            (form.musclesSecondary || []).includes(id)
                              ? "bg-text/80 border-text/80 text-white"
                              : "border-line bg-bg text-muted hover:border-muted hover:text-text"
                          )}
                          onClick={() => setForm(f => ({ ...f, musclesSecondary: toggleArr(f.musclesSecondary, id) }))}
                        >
                          {musclesUk[id] || id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    placeholder="Опис"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    className="h-12 min-h-[44px]"
                    onClick={() => {
                      const nameUk = (form.nameUk || "").trim();
                      if (!nameUk) return;
                      const id = `custom_${slugify(nameUk) || Date.now()}`;
                      addExercise({
                        id,
                        name: { uk: nameUk, en: nameUk },
                        primaryGroup: form.primaryGroup,
                        primaryGroupUk: primaryGroupsUk[form.primaryGroup] || form.primaryGroup,
                        muscles: { primary: form.musclesPrimary || [], secondary: form.musclesSecondary || [], stabilizers: [] },
                        equipment: form.equipment || [],
                        equipmentUk: (form.equipment || []).map(eid => EQUIPMENT_OPTIONS.find(x => x.id === eid)?.label || eid),
                        description: (form.description || "").trim(),
                        source: "manual",
                      });
                      setAddOpen(false);
                      setForm({
                        nameUk: "",
                        primaryGroup: "chest",
                        musclesPrimary: [],
                        musclesSecondary: [],
                        equipment: ["bodyweight"],
                        description: "",
                      });
                    }}
                  >
                    Зберегти
                  </Button>
                  <Button variant="ghost" className="h-12 min-h-[44px]" onClick={() => setAddOpen(false)}>
                    Скасувати
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exercise picker for workout */}
        {pickerOpen && (
          <div className={cn("fixed inset-0 flex items-end", SHEET_Z)} onClick={() => setPickerOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft"
              style={{ paddingBottom: SHEET_BOTTOM_PADDING }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-line rounded-full" />
              </div>
              <div className="px-5 pb-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold text-text leading-tight">Додати вправу в тренування</div>
                    <div className="text-xs text-subtle mt-1">Почни вводити назву</div>
                  </div>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="relative mb-3">
                  <Input
                    placeholder="Пошук вправи…"
                    value={pickQ}
                    onChange={e => setPickQ(e.target.value)}
                  />
                </div>

                {pendingPick && (
                  <div className="mb-3 rounded-2xl border border-warning/50 bg-warning/10 p-4">
                    <div className="text-sm font-bold text-warning mb-2">Мʼязи ще відновлюються</div>
                    {(() => {
                      const cf = recoveryConflictsForExercise(pendingPick, rec.by);
                      return (
                        <div className="text-xs text-warning/90 leading-relaxed space-y-1">
                          {cf.red.length ? <div><span className="font-semibold">Рано навантажувати:</span> {cf.red.map(x => x.label).join(", ")}</div> : null}
                          {cf.yellow.length ? <div><span className="font-semibold">Краще почекати:</span> {cf.yellow.map(x => x.label).join(", ")}</div> : null}
                        </div>
                      );
                    })()}
                    <div className="flex gap-2 mt-3">
                      <Button className="flex-1 h-11" onClick={() => addExerciseToActive(pendingPick)}>
                        Все одно додати
                      </Button>
                      <Button variant="ghost" className="flex-1 h-11" onClick={() => setPendingPick(null)}>
                        Назад
                      </Button>
                    </div>
                  </div>
                )}

                <div className="bg-bg border border-line rounded-2xl overflow-hidden max-h-[55vh] overflow-y-auto">
                  {pickList.length === 0 && (
                    <div className="p-6 text-center text-sm text-subtle">Нічого не знайдено</div>
                  )}
                  {pickQ
                    ? pickList.map(ex => {
                        const pickCf = recoveryConflictsForExercise(ex, rec.by);
                        return (
                          <button
                            key={ex.id}
                            className={cn(
                              "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                              pickCf.hasWarning && "border-l-4 border-l-warning/70"
                            )}
                            onClick={() => {
                              if (!activeWorkoutId) return;
                              if (pickCf.hasWarning) { setPendingPick(ex); return; }
                              addExerciseToActive(ex);
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-sm font-semibold text-text truncate">{ex?.name?.uk || ex?.name?.en}</div>
                              {pickCf.hasWarning && <span className="text-warning text-xs shrink-0">⚠</span>}
                            </div>
                            <div className="text-xs text-subtle mt-0.5">{primaryGroupsUk[ex.primaryGroup] || ex.primaryGroup}</div>
                          </button>
                        );
                      })
                    : pickGrouped.map(g => (
                        <div key={g.id}>
                          <div className="px-4 py-2 bg-panelHi/80 border-b border-line sticky top-0">
                            <span className="text-[10px] font-bold text-subtle uppercase tracking-widest">{g.label}</span>
                          </div>
                          {g.items.map(ex => {
                            const pickCf = recoveryConflictsForExercise(ex, rec.by);
                            return (
                              <button
                                key={ex.id}
                                className={cn(
                                  "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                                  pickCf.hasWarning && "border-l-4 border-l-warning/70"
                                )}
                                onClick={() => {
                                  if (!activeWorkoutId) return;
                                  if (pickCf.hasWarning) { setPendingPick(ex); return; }
                                  addExerciseToActive(ex);
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="text-sm font-semibold text-text truncate">{ex?.name?.uk || ex?.name?.en}</div>
                                  {pickCf.hasWarning && <span className="text-warning text-xs shrink-0">⚠</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {restTimer && (
          <div
            className="fixed left-0 right-0 z-[55] px-4 pointer-events-none"
            style={{ bottom: "calc(58px + env(safe-area-inset-bottom, 0px))" }}
            role="timer"
            aria-live="polite"
            aria-label={`Відпочинок, залишилось ${restTimer.remaining} секунд`}
          >
            <div className="pointer-events-auto max-w-4xl mx-auto flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-float">
              <div>
                <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Відпочинок</div>
                <div className="text-3xl font-extrabold tabular-nums text-text leading-tight">{formatRestClock(restTimer.remaining)}</div>
              </div>
              <Button variant="ghost" className="h-11 min-h-[44px] px-4" type="button" onClick={() => setRestTimer(null)}>
                Скасувати
              </Button>
            </div>
          </div>
        )}

        {finishFlash && (
          <div
            className="fixed left-0 right-0 z-[100] px-4 pointer-events-none"
            style={{ bottom: "calc(58px + env(safe-area-inset-bottom, 0px))" }}
            role="region"
            aria-label="Підсумок тренування"
          >
            <div className="pointer-events-auto max-w-4xl mx-auto">
              {finishFlash.step === "wellbeing" && (
                <div className="rounded-2xl border border-line bg-panel p-4 shadow-float space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
                  <div className="text-sm font-bold text-text">Самопочуття</div>
                  <p className="text-xs text-subtle leading-relaxed">Оціни по шкалі 1–5 (можна пропустити).</p>
                  <div>
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">Енергія</div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={`e${n}`}
                          type="button"
                          className={cn(
                            "min-w-[44px] min-h-[44px] rounded-xl border text-sm font-semibold transition-colors",
                            finishFlash.energy === n ? "bg-text text-white border-text" : "border-line bg-bg text-muted hover:border-muted"
                          )}
                          onClick={() => setFinishFlash(f => f && ({ ...f, energy: n }))}
                          aria-pressed={finishFlash.energy === n}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">Настрій</div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={`m${n}`}
                          type="button"
                          className={cn(
                            "min-w-[44px] min-h-[44px] rounded-xl border text-sm font-semibold transition-colors",
                            finishFlash.mood === n ? "bg-text text-white border-text" : "border-line bg-bg text-muted hover:border-muted"
                          )}
                          onClick={() => setFinishFlash(f => f && ({ ...f, mood: n }))}
                          aria-pressed={finishFlash.mood === n}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 h-12 min-h-[44px]"
                      type="button"
                      onClick={() => setFinishFlash(f => f && ({ ...f, step: "summary" }))}
                    >
                      Пропустити
                    </Button>
                    <Button
                      className="flex-1 h-12 min-h-[44px]"
                      type="button"
                      onClick={() => {
                        const wid = finishFlash.workoutId;
                        if (wid && (finishFlash.energy || finishFlash.mood)) {
                          updateWorkout(wid, {
                            wellbeing: {
                              energy: finishFlash.energy ?? undefined,
                              mood: finishFlash.mood ?? undefined,
                            },
                          });
                        }
                        setFinishFlash(f => f && ({
                          ...f,
                          step: "summary",
                          savedWellbeing: (f.energy || f.mood) ? { energy: f.energy, mood: f.mood } : null,
                        }));
                      }}
                    >
                      Зберегти
                    </Button>
                  </div>
                </div>
              )}

              {finishFlash.step === "summary" && finishFlash.collapsed && (
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 min-h-[44px] shadow-float text-left"
                  onClick={() => setFinishFlash(f => f && ({ ...f, collapsed: false }))}
                >
                  <span className="text-sm font-semibold text-text">✓ Результати</span>
                  <span className="text-xs text-subtle tabular-nums">{formatDurShort(finishFlash.durationSec)}</span>
                </button>
              )}

              {finishFlash.step === "summary" && !finishFlash.collapsed && (
                <div className="rounded-2xl overflow-hidden border border-line shadow-float">
                  {/* Hero */}
                  <div className="p-4" style={{ background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold tracking-widest uppercase text-accent">Завершено</div>
                        <div className="text-lg font-black text-white mt-1 leading-tight">Тренування виконано</div>
                      </div>
                      <button
                        type="button"
                        className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white text-lg"
                        aria-label="Закрити"
                        onClick={() => setFinishFlash(null)}
                      >✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-white/60">Час</div>
                        <div className="text-sm font-black text-white tabular-nums mt-0.5">{formatDurShort(finishFlash.durationSec)}</div>
                      </div>
                      <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-white/60">Вправ</div>
                        <div className="text-lg font-black text-white tabular-nums">{finishFlash.items}</div>
                      </div>
                      <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-white/60">Обʼєм</div>
                        <div className="text-sm font-black text-white tabular-nums mt-0.5">
                          {finishFlash.tonnageKg > 0 ? `${Math.round(finishFlash.tonnageKg)} кг` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Wellbeing row */}
                  {finishFlash.savedWellbeing && (finishFlash.savedWellbeing.energy || finishFlash.savedWellbeing.mood) && (
                    <div className="px-4 py-2.5 bg-panel border-b border-line flex items-center gap-3 text-xs text-subtle">
                      <span>Самопочуття:</span>
                      <span className="font-semibold text-text">
                        енергія {finishFlash.savedWellbeing.energy ?? "—"}/5
                        {" · "}
                        настрій {finishFlash.savedWellbeing.mood ?? "—"}/5
                      </span>
                    </div>
                  )}
                  {/* Actions */}
                  <div className="flex gap-2 p-3 bg-panel">
                    <Button variant="ghost" className="flex-1 h-12 min-h-[44px] rounded-full" type="button" onClick={() => setFinishFlash(f => f && ({ ...f, collapsed: true }))}>
                      Згорнути
                    </Button>
                    <button
                      type="button"
                      className="flex-1 py-3 rounded-full font-bold text-[15px] bg-accent active:scale-[0.98] transition-all"
                      style={{ color: "#0f2d1a" }}
                      onClick={() => setFinishFlash(null)}
                    >
                      Готово
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
