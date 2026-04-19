import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { subtleNavButtonClass } from "@shared/components/ui/buttonPresets";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { Segmented } from "@shared/components/ui/Segmented";
import { useToast } from "@shared/hooks/useToast";
import { WorkoutTemplatesSection } from "../components/WorkoutTemplatesSection";
import { RestTimerOverlay } from "../components/workouts/RestTimerOverlay";
import { WorkoutFinishSheets } from "../components/workouts/WorkoutFinishSheets";
import { AddExerciseSheet } from "../components/workouts/AddExerciseSheet";
import { ExerciseDetailSheet } from "../components/workouts/ExerciseDetailSheet";
import { WorkoutJournalSection } from "../components/workouts/WorkoutJournalSection";
import { WorkoutCatalogSection } from "../components/workouts/WorkoutCatalogSection";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useWorkouts } from "../hooks/useWorkouts";
import { recoveryConflictsForExercise } from "../lib/recoveryConflict";
import {
  ACTIVE_WORKOUT_KEY,
  summarizeWorkoutForFinish,
} from "../lib/workoutUi";

// Shared AudioContext reused across beeps. Creating/closing one per call
// races with quick successive rest-timer completions and fights iOS' audio
// session. Lazily created on first call (after a user gesture) and kept open
// for the lifetime of the page; browsers GC it on unload.
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (sharedAudioCtx && sharedAudioCtx.state !== "closed")
      return sharedAudioCtx;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedAudioCtx = new Ctor();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playRestCompletionSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    // iOS can suspend the context between beeps; resume is a noop if running.
    if (ctx.state === "suspended") void ctx.resume();
    const playBeep = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const t = ctx.currentTime;
    playBeep(880, t, 0.15);
    playBeep(1100, t + 0.18, 0.15);
    playBeep(1320, t + 0.36, 0.3);
  } catch {}
}

function vibrateRestComplete() {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch {}
}

type WorkoutsMode = "catalog" | "log" | "templates";
const WORKOUTS_MODE_ITEMS = [
  { value: "catalog", label: "Каталог" },
  { value: "log", label: "Журнал" },
  { value: "templates", label: "Шаблони" },
] as const satisfies ReadonlyArray<{ value: WorkoutsMode; label: string }>;

export function Workouts() {
  const toast = useToast();
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
    loaded: workoutsLoaded,
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
  const list = useMemo(() => search(q), [search, q]);
  const activeWorkout = workouts.find((w) => w.id === activeWorkoutId) || null;

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

  // Clear a stale activeWorkoutId that no longer matches any workout
  // (e.g. the workout was deleted on another device before sync).
  useEffect(() => {
    if (!workoutsLoaded || !activeWorkoutId) return;
    if (!workouts.some((w) => w.id === activeWorkoutId)) {
      setActiveWorkoutId(null);
    }
  }, [workoutsLoaded, activeWorkoutId, workouts]);

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

  const restCompletedNaturally = useRef(false);

  useEffect(() => {
    if (restTimer === null && restCompletedNaturally.current) {
      restCompletedNaturally.current = false;
      playRestCompletionSound();
      vibrateRestComplete();
    }
  }, [restTimer]);

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) return;
    const id = setInterval(() => {
      setRestTimer((r) => {
        if (!r || r.remaining <= 1) {
          restCompletedNaturally.current = true;
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
        toast.warning(
          "Спочатку натисни «+ Нове» у блоці нижче, щоб з’явилось активне тренування.",
        );
        return;
      }
      if (activeWorkout?.endedAt) {
        toast.warning(
          "Це тренування вже завершено. Обери чернетку в «Останні тренування» або створи нове.",
        );
        return;
      }
      addExerciseToActive(ex);
    },
    [mode, activeWorkoutId, activeWorkout?.endedAt, addExerciseToActive, toast],
  );

  const executeTemplateStart = useCallback(
    (tpl) => {
      const picks = (tpl?.exerciseIds || [])
        .map((id) => exercises.find((e) => e.id === id))
        .filter(Boolean);
      const w = createWorkout();
      const exIdToItemId = {};
      for (const ex of picks) {
        const isCardio = ex.primaryGroup === "cardio";
        const itemId = addItem(w.id, {
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
        exIdToItemId[ex.id] = itemId;
      }
      if ((tpl?.groups || []).length > 0) {
        const workoutGroups = (tpl.groups || [])
          .map((g) => ({
            ...g,
            itemIds: (g.exerciseIds || [])
              .map((exId) => exIdToItemId[exId])
              .filter(Boolean),
          }))
          .filter((g) => (g.itemIds || []).length >= 2);
        if (workoutGroups.length > 0) {
          updateWorkout(w.id, { groups: workoutGroups });
        }
      }
      if (tpl?.id) templateApi.markTemplateUsed(tpl.id);
      setActiveWorkoutId(w.id);
      setMode("log");
    },
    [exercises, createWorkout, addItem, updateWorkout, templateApi],
  );

  const startWorkoutFromTemplate = useCallback(
    (tpl) => {
      const picks = (tpl?.exerciseIds || [])
        .map((id) => exercises.find((e) => e.id === id))
        .filter(Boolean);
      if (!picks.length) {
        toast.warning(
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
      executeTemplateStart(tpl);
    },
    [exercises, rec.by, executeTemplateStart, toast],
  );

  const submitRetroWorkout = useCallback(() => {
    const [y, mo, d] = retroDate.split("-").map(Number);
    const [hh, mm] = (retroTime || "12:00").split(":").map(Number);
    const startedAt = new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
    const w = createWorkoutWithTimes({ startedAt });
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
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-text">Тренування</h1>
            <p className="text-xs text-subtle mt-0.5">
              {activeWorkout && !activeWorkout.endedAt
                ? `Активне · ${(activeWorkout.items || []).length} вправ`
                : `Завершено: ${finishedCount}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={subtleNavButtonClass}
              onClick={() => (window.location.hash = "#progress")}
            >
              Прогрес →
            </button>
            <button
              type="button"
              className={subtleNavButtonClass}
              onClick={() => (window.location.hash = "#programs")}
            >
              Програми →
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              tone="solid"
              size="md"
              accent="fizruk"
              ariaLabel="Режим екрану тренувань"
              items={WORKOUTS_MODE_ITEMS}
              value={mode}
              onChange={setMode}
            />
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
          <WorkoutJournalSection
            activeWorkout={activeWorkout}
            activeDuration={activeDuration}
            workouts={workouts}
            activeWorkoutId={activeWorkoutId}
            setActiveWorkoutId={setActiveWorkoutId}
            retroOpen={retroOpen}
            setRetroOpen={setRetroOpen}
            retroDate={retroDate}
            setRetroDate={setRetroDate}
            retroTime={retroTime}
            setRetroTime={setRetroTime}
            createWorkout={createWorkout}
            setMode={setMode}
            musclesUk={musclesUk}
            recBy={rec.by}
            lastByExerciseId={lastByExerciseId}
            setRestTimer={setRestTimer}
            updateWorkout={updateWorkout}
            updateItem={updateItem}
            removeItem={removeItem}
            setFinishFlash={setFinishFlash}
            endWorkout={endWorkout}
            setDeleteWorkoutConfirm={setDeleteWorkoutConfirm}
            summarizeWorkoutForFinish={summarizeWorkoutForFinish}
            submitRetroWorkout={submitRetroWorkout}
            deleteWorkout={deleteWorkout}
          />
        )}

        {mode === "templates" && (
          <WorkoutTemplatesSection
            exercises={exercises}
            search={search}
            templates={templateApi.templates}
            addTemplate={templateApi.addTemplate}
            updateTemplate={templateApi.updateTemplate}
            removeTemplate={templateApi.removeTemplate}
            restoreTemplate={templateApi.restoreTemplate}
            onStartTemplate={startWorkoutFromTemplate}
          />
        )}

        {(mode === "catalog" || mode === "log") && (
          <WorkoutCatalogSection
            mode={mode}
            q={q}
            setQ={setQ}
            grouped={grouped}
            open={open}
            setOpen={setOpen}
            handleExerciseInListClick={handleExerciseInListClick}
            setSelected={setSelected}
            recoveryConflictsForExercise={recoveryConflictsForExercise}
            rec={rec}
            musclesUk={musclesUk}
          />
        )}

        <ExerciseDetailSheet
          selected={selected}
          onClose={() => setSelected(null)}
          mode={mode}
          musclesUk={musclesUk}
          rec={rec}
          recoveryConflictsForExercise={recoveryConflictsForExercise}
          activeWorkoutId={activeWorkoutId}
          activeWorkout={activeWorkout}
          addExerciseToActive={addExerciseToActive}
          onDeleteRequest={() => setDeleteExerciseConfirm(true)}
          toast={toast}
        />

        <AddExerciseSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          form={form}
          setForm={setForm}
          primaryGroupsUk={primaryGroupsUk}
          musclesUk={musclesUk}
          musclesByPrimaryGroup={musclesByPrimaryGroup}
          addExercise={addExercise}
        />

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
          executeTemplateStart(tpl);
        }}
        onCancel={() => setRiskyTemplateConfirm(null)}
      />
    </div>
  );
}
