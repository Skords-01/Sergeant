/**
 * Orchestrator hook for the `Workouts` page.
 *
 * Phase 2 / round-2 decomposition (initiative 0001 carry-over → 0013):
 * extracted from `Workouts.tsx` so the page entry is below the
 * 600-LOC ESLint guard. Owns the `useState` + `useEffect` + derived
 * memos + `useCallback` handlers that previously lived inline. The
 * page component is now a thin renderer that consumes this hook.
 *
 * Public API stability: the bundled return shape matches what the
 * existing JSX in `Workouts.tsx` was reading from local scope, so
 * callers / sub-components do not need any prop changes.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  safeReadStringLS,
  safeRemoveLS,
  safeWriteLS,
} from "@shared/lib/storage/storage";
import { requestCloudPull } from "@shared/lib/modules/cloudPullRequest";
import { useToast } from "@shared/hooks/useToast";
import { showUndoToast } from "@shared/lib/ui/undoToast";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import {
  useFizrukRestSound,
  type RestTimerState,
} from "../hooks/useFizrukRestSound";
import { useRecovery } from "../hooks/useRecovery";
import {
  useWorkoutTemplates,
  type WorkoutTemplate,
} from "../hooks/useWorkoutTemplates";
import { useWorkouts } from "../hooks/useWorkouts";
import { recoveryConflictsForExercise } from "@sergeant/fizruk-domain";
import type { RawExerciseDef } from "@sergeant/fizruk-domain/data";
import type {
  Workout,
  WorkoutFinishSummary,
  WorkoutGroup,
  WorkoutItem,
} from "@sergeant/fizruk-domain";
import { ACTIVE_WORKOUT_KEY } from "@sergeant/fizruk-domain";
import type { AddExerciseForm } from "../components/workouts/AddExerciseSheet";

export type WorkoutsView = "home" | "catalog" | "log" | "templates";

/**
 * Mirrors `FinishFlashState` in `WorkoutJournalSection` / consumed by
 * `WorkoutFinishSheets`. Owned here so the `useState` setter can be
 * passed across both sheets without re-deriving the shape twice.
 */
export interface FinishFlashState extends WorkoutFinishSummary {
  step: "wellbeing" | "summary";
  collapsed: boolean;
  workoutId: string;
  energy: number | null;
  mood: number | null;
  savedWellbeing?: { energy?: number | null; mood?: number | null } | null;
}

/**
 * The catalog `WorkoutItem` carries the workout `startedAt` when
 * resolved as the most recent occurrence of an exercise. We only attach
 * a single extra field, so widen the canonical domain item rather than
 * lying via `any`.
 */
type LastExerciseItem = WorkoutItem & { _startedAt?: string };

const PRIMARY_GROUP_ORDER = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quadriceps",
  "hamstrings",
  "calves",
  "glutes",
  "full_body",
  "cardio",
];

export function useWorkoutsPageState() {
  const toast = useToast();
  const catalog = useExerciseCatalog();
  const {
    exercises,
    search,
    primaryGroupsUk,
    equipmentUk,
    musclesUk,
    musclesByPrimaryGroup,
    addExercise,
    removeExercise,
  } = catalog;
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
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<RawExerciseDef | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({}));
  const [addOpen, setAddOpen] = useState(false);
  // `view` drives the page chrome:
  //   "home"      — landing layout with active/start hero, recent 3
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

  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState(() =>
    safeReadStringLS(ACTIVE_WORKOUT_KEY),
  );
  const [finishFlash, setFinishFlash] = useState<FinishFlashState | null>(null);
  const [deleteExerciseConfirm, setDeleteExerciseConfirm] = useState(false);
  const [riskyTemplateConfirm, setRiskyTemplateConfirm] =
    useState<WorkoutTemplate | null>(null);
  const [now, setNow] = useState(Date.now());
  const [retroOpen, setRetroOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [retroDate, setRetroDate] = useState(() => {
    const x = new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
  const [retroTime, setRetroTime] = useState("18:00");
  const [form, setForm] = useState<AddExerciseForm>(() => ({
    nameUk: "",
    primaryGroup: "chest",
    musclesPrimary: [],
    musclesSecondary: [],
    equipment: ["bodyweight"],
    description: "",
  }));

  const list = useMemo(() => search(q), [search, q]);
  const activeWorkout = workouts.find((w) => w.id === activeWorkoutId) || null;

  const removeItemWithUndo = useCallback(
    (workoutId: string, itemId: string) => {
      const w = workouts.find((x) => x.id === workoutId);
      if (!w) {
        removeItem(workoutId, itemId);
        return;
      }
      const snapshot = {
        items: w.items || [],
        groups: w.groups || [],
      };
      removeItem(workoutId, itemId);
      showUndoToast(toast, {
        msg: "Вправу видалено з тренування",
        onUndo: () =>
          updateWorkout(workoutId, {
            items: snapshot.items,
            groups: snapshot.groups,
          }),
      });
    },
    [workouts, removeItem, updateWorkout, toast],
  );

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
    if (!activeWorkoutId) safeRemoveLS(ACTIVE_WORKOUT_KEY);
    else safeWriteLS(ACTIVE_WORKOUT_KEY, activeWorkoutId);
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
    } catch {
      /* sessionStorage may be unavailable in private mode */
    }
  }, []);

  const { markCompletedNaturally } = useFizrukRestSound(restTimer);

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) return;
    const id = setInterval(() => {
      setRestTimer((r) => {
        if (!r || r.remaining <= 1) {
          markCompletedNaturally();
          return null;
        }
        return { ...r, remaining: r.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [restTimer, markCompletedNaturally]);

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
    (ex: RawExerciseDef) => {
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
    (ex: RawExerciseDef) => {
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
    (tpl: WorkoutTemplate) => {
      const picks: RawExerciseDef[] = (tpl?.exerciseIds || [])
        .map((id: string) => exercises.find((e) => e.id === id))
        .filter((e): e is RawExerciseDef => Boolean(e));
      const w = createWorkout();
      const exIdToItemId: Record<string, string> = {};
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
        // Templates persist `groups` as `unknown[]` (see useWorkoutTemplates),
        // so narrow each group to the template-shape we read here before
        // building the workout-side `groups` payload. The mapped shape
        // matches the canonical `WorkoutGroup` (`id`, `itemIds` + the
        // optional `type`/`restSec` carried over from the template).
        interface TemplateGroup {
          id: string;
          exerciseIds?: string[];
          itemIds?: string[];
          type?: "circuit" | "superset";
          restSec?: number;
        }
        const workoutGroups: WorkoutGroup[] = (
          (tpl.groups || []) as TemplateGroup[]
        )
          .map((g) => ({
            id: g.id,
            type: g.type,
            restSec: g.restSec,
            itemIds: (g.exerciseIds || [])
              .map((exId: string) => exIdToItemId[exId])
              .filter((id): id is string => Boolean(id)),
          }))
          .filter((g) => g.itemIds.length >= 2);
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
    (tpl: WorkoutTemplate) => {
      const picks: RawExerciseDef[] = (tpl?.exerciseIds || [])
        .map((id: string) => exercises.find((e) => e.id === id))
        .filter((e): e is RawExerciseDef => Boolean(e));
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
    const startedAt = new Date(y!, mo! - 1, d, hh, mm, 0, 0).toISOString();
    const w = createWorkoutWithTimes({ startedAt });
    setActiveWorkoutId(w.id);
    setRetroOpen(false);
  }, [retroDate, retroTime, createWorkoutWithTimes]);

  const lastByExerciseId = useMemo(() => {
    const out: Record<string, LastExerciseItem> = {};
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
    const eqSet = equipmentFilter.length > 0 ? new Set(equipmentFilter) : null;
    const pool = eqSet
      ? list.filter((ex) => (ex.equipment ?? []).some((e) => eqSet.has(e)))
      : list;
    const m = new Map<string, RawExerciseDef[]>();
    for (const ex of pool) {
      const gid = ex.primaryGroup || "full_body";
      const bucket = m.get(gid);
      if (bucket) bucket.push(ex);
      else m.set(gid, [ex]);
    }
    const entries = Array.from(m.entries()).sort((a, b) => {
      const ai = PRIMARY_GROUP_ORDER.indexOf(a[0]);
      const bi = PRIMARY_GROUP_ORDER.indexOf(b[0]);
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
  }, [list, equipmentFilter, primaryGroupsUk]);

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

  // Workouts are local-first (MMKV-web), so PTR's job is to ask the
  // App-level cloud-sync engine for a fresh pull. The local list will
  // re-render automatically once the engine writes new state.
  const handlePullRefresh = useCallback(() => requestCloudPull(2500), []);

  return {
    // catalog
    exercises,
    search,
    primaryGroupsUk,
    equipmentUk,
    musclesUk,
    musclesByPrimaryGroup,
    addExercise,
    removeExercise,
    // workouts API
    workouts,
    workoutsLoaded,
    createWorkout,
    updateWorkout,
    updateItem,
    deleteWorkout,
    restoreWorkout,
    endWorkout,
    addItem,
    removeItemWithUndo,
    // templates
    templateApi,
    // recovery
    rec,
    // toast
    toast,
    // active workout
    activeWorkoutId,
    setActiveWorkoutId,
    activeWorkout,
    activeDuration,
    // view + mode
    view,
    setView,
    mode,
    // catalog filters / accordions
    q,
    setQ,
    equipmentFilter,
    setEquipmentFilter,
    selected,
    setSelected,
    open,
    setOpen,
    addOpen,
    setAddOpen,
    // sheets / dialogs
    quickStartOpen,
    setQuickStartOpen,
    restTimer,
    setRestTimer,
    finishFlash,
    setFinishFlash,
    deleteExerciseConfirm,
    setDeleteExerciseConfirm,
    riskyTemplateConfirm,
    setRiskyTemplateConfirm,
    // retro
    retroOpen,
    setRetroOpen,
    retroDate,
    setRetroDate,
    retroTime,
    setRetroTime,
    submitRetroWorkout,
    // add-exercise form
    form,
    setForm,
    // derived
    grouped,
    lastByExerciseId,
    finishedCount,
    recentWorkouts,
    // handlers
    addExerciseToActive,
    handleExerciseInListClick,
    executeTemplateStart,
    startWorkoutFromTemplate,
    handlePullRefresh,
  };
}

export type WorkoutsPageState = ReturnType<typeof useWorkoutsPageState>;

// Re-export domain symbols that consumers may need alongside the hook.
export type { Workout, RawExerciseDef };

// Setter type aliases used by the consumer JSX.
export type SetView = Dispatch<SetStateAction<WorkoutsView>>;
