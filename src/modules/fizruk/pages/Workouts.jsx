import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { WorkoutTemplatesSection } from "../components/WorkoutTemplatesSection";
import { ActiveWorkoutPanel } from "../components/workouts/ActiveWorkoutPanel";
import { RestTimerOverlay } from "../components/workouts/RestTimerOverlay";
import { WorkoutFinishSheets } from "../components/workouts/WorkoutFinishSheets";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useWorkouts } from "../hooks/useWorkouts";
import { recoveryConflictsForExercise } from "../lib/recoveryConflict";
import {
  ACTIVE_WORKOUT_KEY,
  FIZRUK_SHEET_PAD_CLASS,
  SHEET_Z,
  mondayStartMs,
  summarizeWorkoutForFinish,
} from "../lib/workoutUi";

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
  return a.includes(value) ? a.filter((x) => x !== value) : [...a, value];
}

export function Workouts() {
  const {
    exercises,
    search,
    primaryGroupsUk,
    musclesUk,
    musclesByPrimaryGroup,
    addExercise,
    removeExercise,
  } = useExerciseCatalog();
  const rec = useRecovery();
  const {
    workouts,
    createWorkout,
    createWorkoutWithTimes,
    updateWorkout,
    deleteWorkout,
    endWorkout,
    addItem,
    updateItem,
    removeItem,
  } = useWorkouts();
  const templateApi = useWorkoutTemplates();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(() => ({}));
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState("catalog"); // catalog | log | templates
  const [restTimer, setRestTimer] = useState(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_WORKOUT_KEY) || null;
    } catch {
      return null;
    }
  });
  const [finishFlash, setFinishFlash] = useState(null);
  const [journalLimit, setJournalLimit] = useState(12);
  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState(false);
  const [deleteExerciseConfirm, setDeleteExerciseConfirm] = useState(false);
  const [riskyTemplateConfirm, setRiskyTemplateConfirm] = useState(null); // stores template when risky
  const [now, setNow] = useState(Date.now());
  const [retroOpen, setRetroOpen] = useState(false);
  const [retroDate, setRetroDate] = useState(() => {
    const x = new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
  const [retroTime, setRetroTime] = useState("18:00");
  const [form, setForm] = useState(() => ({
    nameUk: "",
    primaryGroup: "chest",
    musclesPrimary: [],
    musclesSecondary: [],
    equipment: ["bodyweight"],
    description: "",
  }));
  const detailsSheetRef = useRef(null);
  const addExerciseSheetRef = useRef(null);
  useDialogFocusTrap(!!selected, detailsSheetRef, {
    onEscape: () => setSelected(null),
  });
  useDialogFocusTrap(addOpen, addExerciseSheetRef, {
    onEscape: () => setAddOpen(false),
  });
  const suggestedMuscles = useMemo(() => {
    const g = form.primaryGroup;
    const ids = musclesByPrimaryGroup?.[g] || [];
    // show only known labels first
    return ids.filter((id) => musclesUk?.[id]);
  }, [form.primaryGroup, musclesByPrimaryGroup, musclesUk]);
  const list = useMemo(() => search(q), [search, q]);
  const activeWorkout = workouts.find((w) => w.id === activeWorkoutId) || null;
  const workoutQuickStats = useMemo(() => {
    const done = (workouts || []).filter((w) => w.endedAt);
    const weekStart = mondayStartMs(Date.now());
    const thisWeekDone = done.filter((w) => {
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
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      return null;
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
      } else if (m === "log") {
        setMode("log");
        sessionStorage.removeItem("fizruk_workouts_mode");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) return;
    const id = setInterval(() => {
      setRestTimer((r) => {
        if (!r || r.remaining <= 1) {
          try {
            navigator.vibrate?.(200);
          } catch {}
          return null;
        }
        return { ...r, remaining: r.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [restTimer]);

  // Live timer tick — only when there is an active, unfinished workout
  useEffect(
    () => {
      if (!activeWorkout || activeWorkout.endedAt) return;
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- достатньо id/endedAt; повний об’єкт workout змінюється часто
    [activeWorkout?.id, activeWorkout?.endedAt],
  );

  const addExerciseToActive = useCallback(
    (ex) => {
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
    },
    [activeWorkoutId, addItem],
  );

  const handleExerciseInListClick = useCallback(
    (ex) => {
      if (mode !== "log") {
        setSelected(ex);
        return;
      }
      if (!activeWorkoutId) {
        window.alert(
          "Спочатку натисни «+ Нове» у блоці нижче, щоб з’явилось активне тренування.",
        );
        return;
      }
      if (activeWorkout?.endedAt) {
        window.alert(
          "Це тренування вже завершено. Обери чернетку в «Останні тренування» або створи нове.",
        );
        return;
      }
      addExerciseToActive(ex);
    },
    [mode, activeWorkoutId, activeWorkout?.endedAt, addExerciseToActive],
  );

  const startWorkoutFromTemplate = useCallback(
    (tpl) => {
      const picks = (tpl?.exerciseIds || [])
        .map((id) => exercises.find((e) => e.id === id))
        .filter(Boolean);
      if (!picks.length) {
        window.alert(
          "У шаблоні немає вправ з каталогу. Відредагуй шаблон і додай вправи.",
        );
        return;
      }
      const risky = picks.some(
        (ex) => recoveryConflictsForExercise(ex, rec.by).hasWarning,
      );
      if (risky) {
        setRiskyTemplateConfirm(tpl);
        return;
      }
      const w = createWorkout();
      for (const ex of picks) {
        const isCardio = ex.primaryGroup === "cardio";
        addItem(w.id, {
          exerciseId: ex.id,
          nameUk: ex?.name?.uk || ex?.name?.en,
          primaryGroup: ex.primaryGroup,
          musclesPrimary: ex?.muscles?.primary || [],
          musclesSecondary: ex?.muscles?.secondary || [],
          type: isCardio ? "distance" : "strength",
          sets: isCardio ? undefined : [{ weightKg: 0, reps: 0 }],
          durationSec: 0,
          distanceM: isCardio ? 0 : 0,
        });
      }
      try {
        localStorage.setItem(ACTIVE_WORKOUT_KEY, w.id);
      } catch {}
      setActiveWorkoutId(w.id);
      setMode("log");
    },
    [exercises, rec.by, createWorkout, addItem],
  );

  const submitRetroWorkout = useCallback(() => {
    const [y, mo, d] = retroDate.split("-").map(Number);
    const [hh, mm] = (retroTime || "12:00").split(":").map(Number);
    const startedAt = new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
    const w = createWorkoutWithTimes({ startedAt });
    try {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, w.id);
    } catch {}
    setActiveWorkoutId(w.id);
    setRetroOpen(false);
  }, [retroDate, retroTime, createWorkoutWithTimes]);

  const lastByExerciseId = useMemo(() => {
    const out = {};
    for (const w of workouts || []) {
      if (w.id === activeWorkoutId) continue;
      for (const it of w.items || []) {
        const exId = it.exerciseId;
        if (!exId) continue;
        const existing = out[exId];
        if (
          !existing ||
          (w.startedAt || "").localeCompare(existing._startedAt || "") > 0
        ) {
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
    const order = [
      "chest",
      "back",
      "shoulders",
      "arms",
      "core",
      "legs",
      "glutes",
      "full_body",
      "cardio",
    ];
    const entries = Array.from(m.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (
        (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) ||
        a[0].localeCompare(b[0])
      );
    });
    return entries.map(([gid, items]) => ({
      id: gid,
      label: primaryGroupsUk[gid] || gid,
      items: items.slice(0, 80),
      total: items.length,
    }));
  }, [list, primaryGroupsUk]);

  const finishedCount = useMemo(
    () => (workouts || []).filter((w) => w.endedAt).length,
    [workouts],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
        <section className="fizruk-hero-card mb-3" aria-label="Огляд тренувань">
          <div className="text-[11px] font-bold tracking-widest uppercase text-accent">
            Тренування
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">
                Всього
              </div>
              <div className="text-lg font-black text-white tabular-nums">
                {workouts.length}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">
                Завершено
              </div>
              <div className="text-lg font-black text-white tabular-nums">
                {finishedCount}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">
                Активне
              </div>
              <div className="text-lg font-black text-white tabular-nums">
                {activeWorkout ? 1 : 0}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                "text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors",
                mode === "catalog"
                  ? "bg-forest text-white border-forest"
                  : "border-line text-subtle hover:text-text",
              )}
              onClick={() => setMode("catalog")}
              aria-pressed={mode === "catalog"}
            >
              Каталог
            </button>
            <button
              type="button"
              className={cn(
                "text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors",
                mode === "log"
                  ? "bg-forest text-white border-forest"
                  : "border-line text-subtle hover:text-text",
              )}
              onClick={() => setMode("log")}
              aria-pressed={mode === "log"}
            >
              Журнал
            </button>
            <button
              type="button"
              className={cn(
                "text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors",
                mode === "templates"
                  ? "bg-forest text-white border-forest"
                  : "border-line text-subtle hover:text-text",
              )}
              onClick={() => setMode("templates")}
              aria-pressed={mode === "templates"}
            >
              Шаблони
            </button>
            {mode === "catalog" && (
              <Button
                size="sm"
                className="h-9 min-h-[44px] px-4"
                onClick={() => setAddOpen(true)}
                aria-label="Додати вправу в каталог"
              >
                + Додати
              </Button>
            )}
          </div>
        </div>

        {mode === "log" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
                <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
                  Завершено
                </div>
                <div className="text-lg font-extrabold text-text tabular-nums mt-1">
                  {workoutQuickStats.doneCount}
                </div>
              </div>
              <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
                <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
                  Цей тиждень
                </div>
                <div className="text-lg font-extrabold text-text tabular-nums mt-1">
                  {workoutQuickStats.thisWeekDone}
                </div>
              </div>
              <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
                <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
                  В активному
                </div>
                <div className="text-lg font-extrabold text-text tabular-nums mt-1">
                  {workoutQuickStats.activeItems}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full py-3 rounded-2xl border border-line bg-panel text-sm font-semibold text-text hover:bg-panelHi transition-colors"
                onClick={() => setRetroOpen((o) => !o)}
                aria-expanded={retroOpen}
              >
                Записати тренування заднім числом
              </button>
              {retroOpen && (
                <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
                  <p className="text-xs text-subtle leading-relaxed">
                    Вкажи, коли було тренування. Потім додай вправи та впиши кг,
                    повтори, час тощо — як занесення після факту.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                        Дата
                      </div>
                      <input
                        type="date"
                        className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                        value={retroDate}
                        onChange={(e) => setRetroDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                        Час початку
                      </div>
                      <input
                        type="time"
                        className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                        value={retroTime}
                        onChange={(e) => setRetroTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="w-full h-11"
                    onClick={submitRetroWorkout}
                  >
                    Створити й заповнити
                  </Button>
                </div>
              )}
            </div>

            {!activeWorkout && (
              <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card text-center">
                <div className="text-sm font-semibold text-text">
                  Немає активного тренування
                </div>
                <div className="text-xs text-subtle mt-1">
                  Створи «+ Нове» або відкрий «Шаблони». Вправи з каталогу нижче
                  додаються тапом по назві після цього.
                </div>
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
                  <Button
                    variant="ghost"
                    className="flex-1 h-11"
                    onClick={() => setMode("templates")}
                  >
                    Шаблони
                  </Button>
                </div>
              </div>
            )}

            {activeWorkout && (
              <ActiveWorkoutPanel
                activeWorkout={activeWorkout}
                activeDuration={activeDuration}
                lastByExerciseId={lastByExerciseId}
                musclesUk={musclesUk}
                recBy={rec.by}
                removeItem={removeItem}
                updateItem={updateItem}
                updateWorkout={updateWorkout}
                setRestTimer={setRestTimer}
                onFinishClick={() => {
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
                onDeleteWorkout={() => setDeleteWorkoutConfirm(true)}
              />
            )}

            <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
              <div className="px-4 py-3 bg-panelHi/60 border-b border-line">
                <div className="text-xs font-bold text-subtle uppercase tracking-widest">
                  Останні тренування
                </div>
              </div>
              {(workouts || []).length === 0 && (
                <EmptyState
                  compact
                  icon={
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
                    </svg>
                  }
                  title="Поки немає тренувань"
                  description="Натисни «+ Нове тренування» щоб почати"
                />
              )}
              {(workouts || []).slice(0, journalLimit).map((w) => (
                <button
                  key={w.id}
                  onClick={() => setActiveWorkoutId(w.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                    activeWorkoutId === w.id && "bg-text/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">
                      {new Date(w.startedAt).toLocaleDateString("uk-UA", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-subtle">
                        {(w.items || []).length} вправ
                      </span>
                      {activeWorkoutId === w.id ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20">
                          Активне
                        </span>
                      ) : w.endedAt ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-panelHi text-subtle border border-line">
                          Завершене
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                          Чернетка
                        </span>
                      )}
                    </div>
                  </div>
                  {w.note && (
                    <div className="text-xs text-subtle mt-1 italic line-clamp-2">
                      {w.note}
                    </div>
                  )}
                </button>
              ))}
              {(workouts || []).length > journalLimit && (
                <button
                  onClick={() => setJournalLimit((l) => l + 12)}
                  className="w-full py-3 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  Показати більше
                </button>
              )}
              {(workouts || []).length === 0 && (
                <div className="p-6 text-center text-sm text-subtle">
                  Поки тренувань немає
                </div>
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
            onStartTemplate={startWorkoutFromTemplate}
          />
        )}

        {(mode === "catalog" || mode === "log") && (
          <div className="relative mb-3">
            <Input
              placeholder="Пошук (жим, підтягування, спина...)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
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

        {mode === "log" && (
          <p className="text-xs text-subtle mb-2 leading-relaxed">
            Розкрий групу й тапни по вправі — додасться в активне тренування.
            Кнопка «ⓘ» праворуч — опис і фото без додавання.
          </p>
        )}

        {mode !== "templates" && (
          <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
            {grouped.length === 0 ? (
              <div className="p-6 text-center text-sm text-subtle">
                Поки немає вправ. Додай першу через кнопку “+ Додати”.
              </div>
            ) : (
              grouped.map((g) => {
                const isOpen = open[g.id] ?? false;
                return (
                  <div
                    key={g.id}
                    className="border-b border-line last:border-0"
                  >
                    <button
                      onClick={() =>
                        setOpen((o) => ({ ...o, [g.id]: !isOpen }))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-panelHi/60 hover:bg-panelHi transition-colors"
                    >
                      <div className="text-sm font-bold text-text">
                        {g.label}
                      </div>
                      <div className="text-xs text-muted flex items-center gap-2">
                        <span>{g.total}</span>
                        <span className="text-lg leading-none">
                          {isOpen ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>
                    {isOpen && (
                      <div>
                        {g.items.map((ex) => {
                          const catCf = recoveryConflictsForExercise(
                            ex,
                            rec.by,
                          );
                          return (
                            <div
                              key={ex.id}
                              className="flex border-t border-line"
                            >
                              <button
                                type="button"
                                onClick={() => handleExerciseInListClick(ex)}
                                className={cn(
                                  "flex-1 min-w-0 text-left px-4 py-3 transition-colors",
                                  mode === "log"
                                    ? "hover:bg-success/10 active:bg-success/15"
                                    : "hover:bg-panelHi",
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-text truncate flex items-center gap-2">
                                      {ex?.name?.uk || ex?.name?.en}
                                      {catCf.hasWarning ? (
                                        <span
                                          className="text-warning shrink-0"
                                          title="Мʼязи ще відновлюються"
                                        >
                                          ⚠
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-subtle mt-0.5">
                                      Мʼязи:{" "}
                                      <span className="font-semibold text-muted">
                                        {(ex?.muscles?.primary || [])
                                          .map((id) => musclesUk?.[id] || id)
                                          .join(", ") || "—"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-xs text-muted tabular-nums">
                                    {ex.rating ? ex.rating.toFixed(1) : ""}
                                  </div>
                                </div>
                              </button>
                              {mode === "log" && (
                                <button
                                  type="button"
                                  className="shrink-0 w-12 min-h-[48px] flex items-center justify-center border-l border-line/80 text-muted hover:text-text hover:bg-panelHi transition-colors"
                                  aria-label="Опис і фото вправи"
                                  onClick={() => setSelected(ex)}
                                >
                                  <span
                                    className="text-base leading-none"
                                    aria-hidden
                                  >
                                    ⓘ
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {g.total > g.items.length && (
                          <div className="px-4 py-3 text-xs text-subtle border-t border-line">
                            Показано {g.items.length} з {g.total} (уточни пошук
                            щоб звузити)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Details sheet */}
        {selected && (
          <div
            className={cn("fixed inset-0 flex items-end fizruk-sheet", SHEET_Z)}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              role="button"
              tabIndex={0}
              aria-label="Закрити"
              onClick={() => setSelected(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(null);
                }
              }}
            />
            <div
              ref={detailsSheetRef}
              className={cn(
                "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft",
                FIZRUK_SHEET_PAD_CLASS,
              )}
              onPointerDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="fizruk-ex-details-title"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-line rounded-full" />
              </div>
              <div className="px-5 pb-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div
                      id="fizruk-ex-details-title"
                      className="text-lg font-extrabold text-text leading-tight"
                    >
                      {selected?.name?.uk || selected?.name?.en}
                    </div>
                    <div className="text-xs text-subtle mt-1">
                      Основна група:{" "}
                      <span className="font-semibold text-muted">
                        {selected.primaryGroupUk || selected.primaryGroup}
                      </span>
                      {selected.level ? (
                        <>
                          {" "}
                          · рівень:{" "}
                          <span className="font-semibold text-muted">
                            {selected.level}
                          </span>
                        </>
                      ) : null}
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
                      {cf.red.length ? (
                        <div>
                          <span className="font-semibold">Рано:</span>{" "}
                          {cf.red.map((x) => x.label).join(", ")}
                        </div>
                      ) : null}
                      {cf.yellow.length ? (
                        <div className="mt-1">
                          <span className="font-semibold">Краще почекати:</span>{" "}
                          {cf.yellow.map((x) => x.label).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {(selected.images || []).filter(Boolean).length > 0 && (
                  <div className="mb-4 -mx-5 px-5 overflow-x-auto no-scrollbar">
                    <div className="flex gap-3">
                      {selected.images.slice(0, 8).map((src) => (
                        <img
                          key={src}
                          src={src}
                          alt={
                            selected?.name?.uk ||
                            selected?.name?.en ||
                            "exercise"
                          }
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
                  <div className="text-xs font-bold text-subtle uppercase tracking-widest">
                    Мʼязи
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected?.muscles?.primary || []).map((m) => (
                      <span
                        key={m}
                        className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold"
                      >
                        {musclesUk?.[m] || m} · основний
                      </span>
                    ))}
                    {(selected?.muscles?.secondary || []).map((m) => (
                      <span
                        key={m}
                        className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-subtle font-semibold"
                      >
                        {musclesUk?.[m] || m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-subtle uppercase tracking-widest">
                    Обладнання
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.equipmentUk || selected.equipment || []).map(
                      (eq) => (
                        <span
                          key={eq}
                          className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold"
                        >
                          {eq}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                {selected.tips?.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-2">
                      Підказки
                    </div>
                    <ul className="space-y-1.5">
                      {selected.tips.map((t, i) => (
                        <li
                          key={i}
                          className="text-sm text-text leading-relaxed"
                        >
                          <span className="text-muted font-bold mr-2">•</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(selected._custom ||
                  selected.source === "manual" ||
                  String(selected.id || "").startsWith("custom_")) && (
                  <div className="mt-4">
                    <Button
                      variant="danger"
                      className="w-full h-12"
                      onClick={() => setDeleteExerciseConfirm(true)}
                    >
                      Видалити з каталогу
                    </Button>
                  </div>
                )}

                {mode === "log" && (
                  <Button
                    type="button"
                    className="w-full h-12 mt-5 bg-forest text-white border-forest hover:bg-forest/90"
                    onClick={() => {
                      if (!activeWorkoutId) {
                        window.alert("Спочатку натисни «+ Нове» у блоці вище.");
                        return;
                      }
                      if (activeWorkout?.endedAt) {
                        window.alert(
                          "Це тренування вже завершено. Обери чернетку або створи нове.",
                        );
                        return;
                      }
                      addExerciseToActive(selected);
                      setSelected(null);
                    }}
                  >
                    + Додати в активне тренування
                  </Button>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button className="h-12" onClick={() => setSelected(null)}>
                    Закрити
                  </Button>
                  <Button
                    variant="ghost"
                    className={cn("h-12")}
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(
                          selected?.name?.uk || selected?.name?.en || "",
                        )
                        .catch(() => {});
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
          <div
            className={cn("fixed inset-0 flex items-end fizruk-sheet", SHEET_Z)}
            role="presentation"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              role="button"
              tabIndex={0}
              aria-label="Закрити"
              onClick={() => setAddOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAddOpen(false);
                }
              }}
            />
            <div
              ref={addExerciseSheetRef}
              className={cn(
                "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[92dvh] flex flex-col",
                FIZRUK_SHEET_PAD_CLASS,
              )}
              onPointerDown={(e) => e.stopPropagation()}
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
                    <div
                      id="add-ex-title"
                      className="text-lg font-extrabold text-text leading-tight"
                    >
                      Додати вправу
                    </div>
                    <div className="text-xs text-subtle mt-1">
                      Збережеться локально на цьому пристрої
                    </div>
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
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nameUk: e.target.value }))
                    }
                    aria-label="Назва вправи українською"
                  />

                  <div className="rounded-2xl border border-line bg-panelHi px-3">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">
                      Основна група
                    </div>
                    <select
                      className="w-full min-h-[44px] bg-transparent text-sm text-text outline-none py-2"
                      value={form.primaryGroup}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          primaryGroup: e.target.value,
                          musclesPrimary: [],
                          musclesSecondary: [],
                        }))
                      }
                      aria-label="Основна група м’язів"
                    >
                      {Object.keys(primaryGroupsUk).map((id) => (
                        <option key={id} value={id}>
                          {primaryGroupsUk[id]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                      Обладнання
                    </div>
                    <div className="py-2 flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map((o) => {
                        const active = (form.equipment || []).includes(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                equipment: toggleArr(f.equipment, o.id),
                              }))
                            }
                            className={cn(
                              "text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors",
                              active
                                ? "bg-text text-white border-text"
                                : "border-line bg-bg text-muted hover:border-muted hover:text-text",
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
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                      Основні мʼязи
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestedMuscles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors",
                            (form.musclesPrimary || []).includes(id)
                              ? "bg-primary border-primary text-white"
                              : "border-line bg-bg text-muted hover:border-muted hover:text-text",
                          )}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              musclesPrimary: toggleArr(f.musclesPrimary, id),
                            }))
                          }
                        >
                          {musclesUk[id] || id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                      Супутні мʼязи
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestedMuscles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors",
                            (form.musclesSecondary || []).includes(id)
                              ? "bg-text/80 border-text/80 text-white"
                              : "border-line bg-bg text-muted hover:border-muted hover:text-text",
                          )}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              musclesSecondary: toggleArr(
                                f.musclesSecondary,
                                id,
                              ),
                            }))
                          }
                        >
                          {musclesUk[id] || id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    placeholder="Опис"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
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
                        primaryGroupUk:
                          primaryGroupsUk[form.primaryGroup] ||
                          form.primaryGroup,
                        muscles: {
                          primary: form.musclesPrimary || [],
                          secondary: form.musclesSecondary || [],
                          stabilizers: [],
                        },
                        equipment: form.equipment || [],
                        equipmentUk: (form.equipment || []).map(
                          (eid) =>
                            EQUIPMENT_OPTIONS.find((x) => x.id === eid)
                              ?.label || eid,
                        ),
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
                  <Button
                    variant="ghost"
                    className="h-12 min-h-[44px]"
                    onClick={() => setAddOpen(false)}
                  >
                    Скасувати
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <RestTimerOverlay
          restTimer={restTimer}
          onCancel={() => setRestTimer(null)}
        />

        <WorkoutFinishSheets
          finishFlash={finishFlash}
          setFinishFlash={setFinishFlash}
          updateWorkout={updateWorkout}
        />
      </div>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={deleteWorkoutConfirm}
        title="Видалити тренування?"
        description="Дані цього тренування будуть втрачені назавжди."
        confirmLabel="Видалити"
        onConfirm={() => {
          if (activeWorkout) {
            deleteWorkout(activeWorkout.id);
            setActiveWorkoutId((prev) =>
              prev === activeWorkout.id ? null : prev,
            );
          }
          setDeleteWorkoutConfirm(false);
        }}
        onCancel={() => setDeleteWorkoutConfirm(false)}
      />

      <ConfirmDialog
        open={deleteExerciseConfirm}
        title="Видалити вправу?"
        description="Вправу буде видалено з каталогу. Записи в тренуваннях залишаться."
        confirmLabel="Видалити"
        onConfirm={() => {
          if (selected && removeExercise(selected.id)) setSelected(null);
          setDeleteExerciseConfirm(false);
        }}
        onCancel={() => setDeleteExerciseConfirm(false)}
      />

      <ConfirmDialog
        open={!!riskyTemplateConfirm}
        title="М'язи ще відновлюються"
        description="У шаблоні є вправи на групи м'язів, які ще не відновились. Почати тренування все одно?"
        confirmLabel="Так, почати"
        cancelLabel="Скасувати"
        danger={false}
        onConfirm={() => {
          const tpl = riskyTemplateConfirm;
          setRiskyTemplateConfirm(null);
          if (!tpl) return;
          const picks = (tpl?.exerciseIds || [])
            .map((id) => exercises.find((e) => e.id === id))
            .filter(Boolean);
          const w = createWorkout();
          for (const ex of picks) {
            const isCardio = ex.primaryGroup === "cardio";
            addItem(w.id, {
              exerciseId: ex.id,
              nameUk: ex?.name?.uk || ex?.name?.en,
              primaryGroup: ex.primaryGroup,
              musclesPrimary: ex?.muscles?.primary || [],
              musclesSecondary: ex?.muscles?.secondary || [],
              type: isCardio ? "distance" : "strength",
              sets: isCardio ? undefined : [{ weightKg: 0, reps: 0 }],
              durationSec: 0,
              distanceM: isCardio ? 0 : 0,
            });
          }
          try {
            localStorage.setItem(ACTIVE_WORKOUT_KEY, w.id);
          } catch {}
          setActiveWorkoutId(w.id);
          setMode("log");
        }}
        onCancel={() => setRiskyTemplateConfirm(null)}
      />
    </div>
  );
}
