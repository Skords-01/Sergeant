/**
 * Fizruk `Workouts` page (round-2 decomposition shell).
 *
 * Phase 2 / round-2 decomposition (initiative 0001 carry-over → 0013):
 * the previous 745-LOC file has been split into:
 *
 *   - `useWorkoutsPageState.ts` — orchestrator hook with all `useState`
 *     / `useEffect` / `useMemo` / `useCallback` orchestration, plus the
 *     `WorkoutsView` / `FinishFlashState` types it owns.
 *   - existing `components/workouts/*` — the per-section sub-trees
 *     (`WorkoutsHome`, `WorkoutJournalSection`, `WorkoutCatalogSection`,
 *     `WorkoutTemplatesSection`, `ExerciseDetailSheet`, `AddExerciseSheet`,
 *     `QuickStartSheet`, `RestTimerOverlay`, `WorkoutFinishSheets`).
 *
 * This page is intentionally thin: it destructures the bundled state
 * from the orchestrator hook and wires it through the visual chunks.
 * Behaviour is identical to before — see `useWorkoutsPageState` for any
 * change to a handler / derived datum.
 */

import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { Skeleton } from "@shared/components/ui/Skeleton";
import {
  DataState,
  type DataStateQueryLike,
} from "@shared/components/ui/DataState";
import { showUndoToast } from "@shared/lib/ui/undoToast";
import { WorkoutTemplatesSection } from "../components/WorkoutTemplatesSection";
import { RestTimerOverlay } from "../components/workouts/RestTimerOverlay";
import { WorkoutFinishSheets } from "../components/workouts/WorkoutFinishSheets";
import { AddExerciseSheet } from "../components/workouts/AddExerciseSheet";
import { ExerciseDetailSheet } from "../components/workouts/ExerciseDetailSheet";
import { WorkoutJournalSection } from "../components/workouts/WorkoutJournalSection";
import { WorkoutCatalogSection } from "../components/workouts/WorkoutCatalogSection";
import { QuickStartSheet } from "../components/workouts/QuickStartSheet";
import { WorkoutsHome } from "../components/workouts/WorkoutsHome";
import { recoveryConflictsForExercise } from "@sergeant/fizruk-domain";
import type { RawExerciseDef } from "@sergeant/fizruk-domain/data";
import type { Workout } from "@sergeant/fizruk-domain";
import { summarizeWorkoutForFinish } from "@sergeant/fizruk-domain";
import { useWorkoutsPageState } from "./useWorkoutsPageState";

export function Workouts() {
  const {
    exercises,
    search,
    primaryGroupsUk,
    equipmentUk,
    musclesUk,
    musclesByPrimaryGroup,
    addExercise,
    removeExercise,
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
    templateApi,
    rec,
    toast,
    activeWorkoutId,
    setActiveWorkoutId,
    activeWorkout,
    activeDuration,
    view,
    setView,
    mode,
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
    retroOpen,
    setRetroOpen,
    retroDate,
    setRetroDate,
    retroTime,
    setRetroTime,
    submitRetroWorkout,
    form,
    setForm,
    grouped,
    lastByExerciseId,
    finishedCount,
    recentWorkouts,
    addExerciseToActive,
    handleExerciseInListClick,
    executeTemplateStart,
    startWorkoutFromTemplate,
    handlePullRefresh,
  } = useWorkoutsPageState();

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

  const workoutsLoadingSkeleton = (
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
  );

  return (
    <PullToRefresh onRefresh={handlePullRefresh} variant="fizruk">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
        <div className="flex items-center gap-3 mb-3">
          {view !== "home" ? (
            <button
              type="button"
              className="w-9 h-9 -ml-1 rounded-xl flex items-center justify-center text-text/80 hover:bg-surface-2"
              onClick={() => setView("home")}
              aria-label="Повернутись до тренувань"
            >
              ‹
            </button>
          ) : null}
          <div className="flex-1">
            <h1 className="text-style-title text-text">
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
            onOpenSession={() => setView("log")}
            onOpenCatalog={() => setView("catalog")}
            onOpenTemplates={() => setView("templates")}
            onOpenJournal={() => setView("log")}
            onRequestStart={() => setQuickStartOpen(true)}
            onOpenRetro={() => {
              setRetroOpen(true);
              setView("log");
            }}
          />
        ) : null}

        {view === "log" && (
          // DataState contract: `data === undefined` triggers the skeleton
          // slot. `useWorkouts` flips `loaded` from false → true after one
          // tick on mount (it rehydrates from `localStorage` / SQLite),
          // so on first paint we feed `data: undefined` and from the
          // second tick onwards `data` is the real list — even when it
          // happens to be empty. This prevents the "порожньо" empty-state
          // inside `WorkoutJournalSection` from flashing during hydration.
          <DataState query={journalQuery} skeleton={workoutsLoadingSkeleton}>
            {() => (
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
                removeItem={removeItemWithUndo}
                setFinishFlash={setFinishFlash}
                endWorkout={endWorkout}
                summarizeWorkoutForFinish={summarizeWorkoutForFinish}
                submitRetroWorkout={submitRetroWorkout}
                deleteWorkout={deleteWorkout}
                restoreWorkout={restoreWorkout}
              />
            )}
          </DataState>
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
            equipmentFilter={equipmentFilter}
            setEquipmentFilter={setEquipmentFilter}
            equipmentUk={equipmentUk}
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

        <QuickStartSheet
          open={quickStartOpen}
          onClose={() => setQuickStartOpen(false)}
          exercises={exercises}
          search={search}
          primaryGroupsUk={primaryGroupsUk}
          onPickTemplate={() => {
            setQuickStartOpen(false);
            setView("templates");
          }}
          onConfirmExercises={(picks: RawExerciseDef[]) => {
            // Build a fresh ad-hoc session and pre-load the picked
            // exercises before flipping the active flag — that way the
            // session-level live timer (`activeWorkout.startedAt`) is
            // only created after the user confirmed their selection,
            // matching the user-stated requirement that the timer must
            // not start before exercises are lined up.
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
                durationSec: isCardio ? 0 : 0,
                distanceM: isCardio ? 0 : 0,
              });
            }
            setActiveWorkoutId(w.id);
            setQuickStartOpen(false);
            setView("log");
          }}
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

      {/*
        Confirmation dialogs.

        The "Delete active workout" `ConfirmDialog` was removed in favour
        of the unified soft-delete flow (`onDeleteWorkout` in
        `WorkoutJournalSection`) that calls `deleteWorkout` immediately
        and surfaces a 5 s undo toast via `showUndoToast`. Per the
        unified-undo policy, only non-reversible flows (e.g. exercise
        removal that detaches the catalog entry) keep an explicit
        confirmation step.
      */}
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
    </PullToRefresh>
  );
}
