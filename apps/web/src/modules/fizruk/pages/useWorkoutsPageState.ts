import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACTIVE_WORKOUT_KEY,
  recoveryConflictsForExercise,
} from "@sergeant/fizruk-domain";
import type { Workout, WorkoutGroup } from "@sergeant/fizruk-domain";
import type { RawExerciseDef } from "@sergeant/fizruk-domain/data";
import { type DataStateQueryLike } from "@shared/components/ui/DataState";
import { requestCloudPull } from "@shared/lib/modules/cloudPullRequest";
import {
  safeReadStringLS,
  safeRemoveLS,
  safeWriteLS,
} from "@shared/lib/storage/storage";
import { showUndoToast } from "@shared/lib/ui/undoToast";
import { useToast } from "@shared/hooks/useToast";
import { type AddExerciseForm } from "../components/workouts/AddExerciseSheet";
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
import {
  PRIMARY_GROUP_ORDER,
  buildWorkoutItemFromExercise,
  deriveWorkoutsMode,
  todayLocalISODate,
  type FinishFlashState,
  type LastExerciseItem,
  type TemplateGroup,
  type WorkoutsView,
} from "./Workouts.helpers";

/**
 * Orchestrator hook for the Workouts page.
 *
 * Owns every piece of state, derived value, async effect and callback
 * the composition root used to thread inline. Callers consume the
 * returned object as `s` and forward fields to their corresponding
 * sheets/sections — the JSX shell ends up close to a pure render-tree
 * builder. This mirrors the FinykApp + RoutineApp decomposition pattern
 * (Phase 2 items 1–6 of initiative 0001), keeping behaviour identical
 * to the pre-decomposition Workouts page.
 */
export function useWorkoutsPageState() {
  const toast = useToast();
  const {
    exercises,
    search,
    primaryGroupsUk,
    equipmentUk,
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

  const [q, setQ] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<RawExerciseDef | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({}));
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
  const mode = deriveWorkoutsMode(view);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState(() =>
    safeReadStringLS(ACTIVE_WORKOUT_KEY),
  );
  const [finishFlash, setFinishFlash] = useState<FinishFlashState | null>(null);
  const [deleteExerciseConfirm, setDeleteExerciseConfirm] = useState(false);
  const [riskyTemplateConfirm, setRiskyTemplateConfirm] =
    useState<WorkoutTemplate | null>(null); // stores template when risky
  const [now, setNow] = useState(Date.now());
  const [retroOpen, setRetroOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [retroDate, setRetroDate] = useState(todayLocalISODate);
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
    } catch {}
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
      addItem(activeWorkoutId, buildWorkoutItemFromExercise(ex));
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
        const itemId = addItem(w.id, buildWorkoutItemFromExercise(ex));
        exIdToItemId[ex.id] = itemId;
      }
      if ((tpl?.groups || []).length > 0) {
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

  /**
   * Called from QuickStartSheet's "confirm" CTA. Builds a fresh ad-hoc
   * session and pre-loads the picked exercises before flipping the
   * active flag — that way the session-level live timer
   * (`activeWorkout.startedAt`) is only created after the user
   * confirmed their selection, matching the user-stated requirement
   * that the timer must not start before exercises are lined up.
   */
  const confirmQuickStartExercises = useCallback(
    (picks: RawExerciseDef[]) => {
      const w = createWorkout();
      for (const ex of picks) {
        addItem(w.id, buildWorkoutItemFromExercise(ex));
      }
      setActiveWorkoutId(w.id);
      setQuickStartOpen(false);
      setView("log");
    },
    [createWorkout, addItem],
  );

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
    const order: readonly string[] = PRIMARY_GROUP_ORDER;
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

  // DataState contract for the workout journal:
  //   - `useWorkouts` flips `loaded` from false → true after the first
  //     hydration tick. While `loaded === false` we feed `data: undefined`
  //     so DataState renders the skeleton slot; from the second tick on
  //     `data` is the real list (possibly empty), which lets the journal
  //     render its own "порожньо" empty-state without flashing it during
  //     mount.
  //   - `isLoading` mirrors the inverted `loaded` flag so a future
  //     stale-revalidate (cloud pull → re-merge) keeps the list visible.
  const journalQuery: DataStateQueryLike<readonly Workout[]> = {
    data: workoutsLoaded ? workouts : undefined,
    isLoading: !workoutsLoaded,
  };

  const confirmDeleteSelectedExercise = useCallback(() => {
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
  }, [selected, removeExercise, addExercise, toast]);

  const confirmRiskyTemplateStart = useCallback(() => {
    const tpl = riskyTemplateConfirm;
    setRiskyTemplateConfirm(null);
    if (!tpl) return;
    executeTemplateStart(tpl);
  }, [riskyTemplateConfirm, executeTemplateStart]);

  const openQuickStart = useCallback(() => setQuickStartOpen(true), []);
  const closeQuickStart = useCallback(() => setQuickStartOpen(false), []);
  const goHome = useCallback(() => setView("home"), []);
  const goCatalog = useCallback(() => setView("catalog"), []);
  const goTemplates = useCallback(() => setView("templates"), []);
  const goLog = useCallback(() => setView("log"), []);
  const openAddSheet = useCallback(() => setAddOpen(true), []);
  const closeAddSheet = useCallback(() => setAddOpen(false), []);
  const onSelectedSheetClose = useCallback(() => setSelected(null), []);
  const onRequestDeleteExercise = useCallback(
    () => setDeleteExerciseConfirm(true),
    [],
  );
  const dismissRiskyTemplateConfirm = useCallback(
    () => setRiskyTemplateConfirm(null),
    [],
  );
  const dismissDeleteExerciseConfirm = useCallback(
    () => setDeleteExerciseConfirm(false),
    [],
  );
  const cancelRestTimer = useCallback(() => setRestTimer(null), []);

  const openRetroFromHome = useCallback(() => {
    setRetroOpen(true);
    setView("log");
  }, []);

  const onPickTemplateFromQuickStart = useCallback(() => {
    setQuickStartOpen(false);
    setView("templates");
  }, []);

  return {
    // toast + catalog/template raw API
    toast,
    exercises,
    search,
    primaryGroupsUk,
    equipmentUk,
    musclesUk,
    musclesByPrimaryGroup,
    addExercise,
    rec,
    workouts,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    restoreWorkout,
    endWorkout,
    updateItem,
    templateApi,
    // page state
    q,
    setQ,
    equipmentFilter,
    setEquipmentFilter,
    selected,
    setSelected,
    open,
    setOpen,
    addOpen,
    view,
    setView,
    mode,
    restTimer,
    setRestTimer,
    activeWorkoutId,
    setActiveWorkoutId,
    finishFlash,
    setFinishFlash,
    deleteExerciseConfirm,
    riskyTemplateConfirm,
    retroOpen,
    setRetroOpen,
    quickStartOpen,
    retroDate,
    setRetroDate,
    retroTime,
    setRetroTime,
    form,
    setForm,
    activeWorkout,
    activeDuration,
    grouped,
    finishedCount,
    recentWorkouts,
    journalQuery,
    lastByExerciseId,
    // callbacks
    addExerciseToActive,
    handleExerciseInListClick,
    startWorkoutFromTemplate,
    submitRetroWorkout,
    confirmQuickStartExercises,
    handlePullRefresh,
    removeItemWithUndo,
    confirmDeleteSelectedExercise,
    confirmRiskyTemplateStart,
    openQuickStart,
    closeQuickStart,
    goHome,
    goCatalog,
    goTemplates,
    goLog,
    openAddSheet,
    closeAddSheet,
    onSelectedSheetClose,
    onRequestDeleteExercise,
    dismissRiskyTemplateConfirm,
    dismissDeleteExerciseConfirm,
    cancelRestTimer,
    openRetroFromHome,
    onPickTemplateFromQuickStart,
  };
}
