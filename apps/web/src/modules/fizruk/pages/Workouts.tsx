import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { useToast } from "@shared/hooks/useToast";
import { showUndoToast } from "@shared/lib/undoToast";
import { hapticPattern } from "@shared/lib/haptic";
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
import { recoveryConflictsForExercise } from "@sergeant/fizruk-domain";
import {
  ACTIVE_WORKOUT_KEY,
  summarizeWorkoutForFinish,
} from "@sergeant/fizruk-domain";
import { computeWorkoutSummary } from "@sergeant/fizruk-domain/domain";

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
  // Haptic helper respects prefers-reduced-motion and swallows browser
  // throttling errors that raw `navigator.vibrate` does not.
  hapticPattern([200, 100, 200]);
}

type WorkoutsView = "home" | "catalog" | "log" | "templates";

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
    restoreWorkout,
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
  // `view` drives the page chrome:
  //   "home"      — new landing layout with active/start hero, recent 3
  //                 journal rows and quick-link tiles. Replaces the old
  //                 default that dropped users straight into the catalog.
  //   "log"       — active-workout panel + exercise catalog below (this is
  //                 where you actually run a session and add exercises).
  //   "catalog"   — browse-only catalog (no active-workout wiring).
  //   "templates" — workout templates list.
  const [view, setView] = useState<WorkoutsView>("home");
  // `mode` is still exposed to legacy subcomponents that branch on
  // "catalog" vs "log" (exercise-in-list click handler, `ExerciseDetailSheet`,
  // `WorkoutCatalogSection`). Kept in sync with `view` for those subviews.
  const mode = view === "templates" || view === "home" ? "catalog" : view;
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
        setView("templates");
        sessionStorage.removeItem("fizruk_workouts_mode");
      } else if (m === "log") {
        setView("log");
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
      setView("log");
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

  const recentWorkouts = useMemo(
    () =>
      [...(workouts || [])]
        .sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        )
        .slice(0, 3),
    [workouts],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
        <div className="flex items-center gap-3 mb-3">
          {view !== "home" ? (
            <button
              type="button"
              className="w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-text/80 hover:bg-surface-2"
              onClick={() => setView("home")}
              aria-label="Повернутись до тренувань"
            >
              ‹
            </button>
          ) : null}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-text">
              {view === "catalog"
                ? "Каталог вправ"
                : view === "templates"
                  ? "Шаблони"
                  : view === "log"
                    ? activeWorkout && !activeWorkout.endedAt
                      ? "Активне тренування"
                      : "Журнал"
                    : "Тренування"}
            </h1>
            {view === "home" ? (
              <p className="text-xs text-subtle mt-0.5">
                {activeWorkout && !activeWorkout.endedAt
                  ? `Активне · ${(activeWorkout.items || []).length} вправ`
                  : finishedCount > 0
                    ? `Завершено: ${finishedCount}`
                    : "Перше тренування — попереду"}
              </p>
            ) : null}
          </div>
          {view === "catalog" ? (
            <Button
              size="sm"
              className="h-9 min-h-[44px] px-4"
              onClick={() => setAddOpen(true)}
              aria-label="Додати вправу в каталог"
            >
              + Додати
            </Button>
          ) : null}
        </div>

        {view === "home" ? (
          <WorkoutsHome
            activeWorkout={activeWorkout}
            activeDuration={activeDuration}
            recentWorkouts={recentWorkouts}
            createWorkout={createWorkout}
            setActiveWorkoutId={setActiveWorkoutId}
            onOpenSession={() => setView("log")}
            onOpenCatalog={() => setView("catalog")}
            onOpenTemplates={() => setView("templates")}
            onOpenJournal={() => setView("log")}
            onOpenRetro={() => {
              setRetroOpen(true);
              setView("log");
            }}
          />
        ) : null}

        {view === "log" && !workoutsLoaded && (
          // First-paint placeholder while `useWorkouts` is still rehydrating
          // from `localStorage` (one tick on mount). Prevents the "порожньо"
          // empty-state from flashing before real data renders — matches the
          // Skeleton pattern already used in Finyk.
          <div
            className="space-y-3"
            role="status"
            aria-live="polite"
            aria-label="Завантажуємо тренування"
          >
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {view === "log" && workoutsLoaded && (
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
            setMode={setView}
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

        {view === "templates" && (
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

        {(view === "catalog" || view === "log") && (
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
        description="Можна повернути одразу після видалення."
        confirmLabel="Видалити"
        onConfirm={() => {
          if (activeWorkout) {
            // Snapshot before delete so undo can re-insert with the
            // original startedAt/items/groups intact (chronological
            // order preserved by `restoreWorkout`).
            const snapshot = activeWorkout;
            deleteWorkout(snapshot.id);
            setActiveWorkoutId((prev) => (prev === snapshot.id ? null : prev));
            showUndoToast(toast, {
              msg: "Тренування видалено",
              onUndo: () => restoreWorkout(snapshot),
            });
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
          if (selected) {
            const snapshot = selected;
            if (removeExercise(snapshot.id)) {
              setSelected(null);
              showUndoToast(toast, {
                msg: `Вправу «${snapshot?.name?.uk || "без назви"}» видалено`,
                onUndo: () => addExercise(snapshot),
              });
            }
          }
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

/**
 * Landing view for the Workouts page.
 *
 * Shows one dominant path ("Почати тренування" → active session) plus two
 * supporting shortcuts (recent sessions preview and quick-link tiles to
 * the catalog / templates / full journal).
 */
interface WorkoutsHomeProps {
  activeWorkout: {
    id: string;
    startedAt: string;
    endedAt?: string | null;
    items?: ReadonlyArray<unknown>;
  } | null;
  activeDuration: string | null;
  recentWorkouts: ReadonlyArray<{
    id: string;
    startedAt: string;
    endedAt?: string | null;
    items?: ReadonlyArray<unknown>;
  }>;
  createWorkout: () => { id: string };
  setActiveWorkoutId: (id: string | null) => void;
  onOpenSession: () => void;
  onOpenCatalog: () => void;
  onOpenTemplates: () => void;
  onOpenJournal: () => void;
  onOpenRetro: () => void;
}

function WorkoutsHome({
  activeWorkout,
  activeDuration,
  recentWorkouts,
  createWorkout,
  setActiveWorkoutId,
  onOpenSession,
  onOpenCatalog,
  onOpenTemplates,
  onOpenJournal,
  onOpenRetro,
}: WorkoutsHomeProps) {
  const hasActive = !!activeWorkout && !activeWorkout.endedAt;

  const handleStart = () => {
    const w = createWorkout();
    setActiveWorkoutId(w.id);
    onOpenSession();
  };

  return (
    <div className="space-y-4">
      {hasActive ? (
        <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-teal-700">
                Активне тренування
              </div>
              <div className="mt-1 text-sm text-text">
                <span className="font-bold">{activeDuration ?? "00:00"}</span>
                {" · "}
                {(activeWorkout?.items || []).length} вправ
              </div>
            </div>
            <Button className="h-11 px-4" onClick={onOpenSession}>
              Відкрити →
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <div className="text-sm font-semibold text-text">
            Немає активного тренування
          </div>
          <div className="text-xs text-subtle mt-1">
            Почни нове або обери один із збережених шаблонів.
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button className="h-12 text-base" onClick={handleStart}>
              ▶︎ Почати тренування
            </Button>
            <Button
              variant="ghost"
              className="h-12 text-base"
              onClick={onOpenTemplates}
            >
              📋 Почати з шаблону →
            </Button>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        className="h-11 w-full text-sm"
        onClick={onOpenRetro}
      >
        ✏️ Внести проведене заняття
      </Button>

      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-sm font-semibold text-text/80">
            Останні тренування
          </h2>
          {recentWorkouts.length > 0 ? (
            <button
              type="button"
              className="text-xs font-semibold text-teal-700 hover:underline"
              onClick={onOpenJournal}
            >
              Всі →
            </button>
          ) : null}
        </div>
        {recentWorkouts.length > 0 ? (
          <ul className="space-y-2">
            {recentWorkouts.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-xl border border-border bg-surface-2 px-3 py-3 flex items-center justify-between hover:bg-surface-3"
                  onClick={onOpenJournal}
                >
                  <RecentWorkoutSummary workout={w} />
                  <span className="text-subtle">›</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs text-subtle">
            Після першого завершеного тренування тут з&apos;являться останні
            сесії.
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text/80 px-1 mb-2">
          Довідники
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl border border-border bg-surface-2 p-4 text-left hover:bg-surface-3"
            onClick={onOpenCatalog}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📚</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-text">
                  Каталог вправ
                </div>
                <div className="text-xs text-subtle mt-0.5">
                  Пошук · групи м&apos;язів · своя вправа
                </div>
              </div>
              <span className="text-subtle">›</span>
            </div>
          </button>
          <button
            type="button"
            className="rounded-xl border border-border bg-surface-2 p-4 text-left hover:bg-surface-3"
            onClick={onOpenTemplates}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-text">Шаблони</div>
                <div className="text-xs text-subtle mt-0.5">
                  Збережені набори вправ на швидкий старт
                </div>
              </div>
              <span className="text-subtle">›</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

interface RecentWorkoutSummaryProps {
  workout: {
    id: string;
    startedAt: string;
    endedAt?: string | null;
    items?: ReadonlyArray<unknown>;
  };
}

function RecentWorkoutSummary({ workout }: RecentWorkoutSummaryProps) {
  const summary = useMemo(
    () => computeWorkoutSummary(workout as never),
    [workout],
  );
  const started = new Date(workout.startedAt);
  const dateLabel = started.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
  });
  const parts: string[] = [];
  if (summary.itemCount > 0) parts.push(`${summary.itemCount} вправ`);
  if (summary.setCount > 0) parts.push(`${summary.setCount} сетів`);
  const durMin = summary.durationSec
    ? Math.max(1, Math.round(summary.durationSec / 60))
    : null;
  if (durMin !== null) parts.push(`${durMin} хв`);
  const subtitle = parts.length ? parts.join(" · ") : "порожнє тренування";

  return (
    <div className="flex-1 pr-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-text">{dateLabel}</span>
        {!summary.isFinished ? (
          <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded-full">
            Чернетка
          </span>
        ) : null}
      </div>
      <div className="text-xs text-subtle mt-0.5 truncate">{subtitle}</div>
    </div>
  );
}
