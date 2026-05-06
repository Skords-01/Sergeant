import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { DataState } from "@shared/components/ui/DataState";
import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import { Skeleton } from "@shared/components/ui/Skeleton";
import {
  recoveryConflictsForExercise,
  summarizeWorkoutForFinish,
} from "@sergeant/fizruk-domain";
import { WorkoutTemplatesSection } from "../components/WorkoutTemplatesSection";
import { AddExerciseSheet } from "../components/workouts/AddExerciseSheet";
import { ExerciseDetailSheet } from "../components/workouts/ExerciseDetailSheet";
import { QuickStartSheet } from "../components/workouts/QuickStartSheet";
import { RestTimerOverlay } from "../components/workouts/RestTimerOverlay";
import { WorkoutCatalogSection } from "../components/workouts/WorkoutCatalogSection";
import { WorkoutFinishSheets } from "../components/workouts/WorkoutFinishSheets";
import { WorkoutJournalSection } from "../components/workouts/WorkoutJournalSection";
import { WorkoutsHome } from "../components/workouts/WorkoutsHome";
import { useWorkoutsPageState } from "./useWorkoutsPageState";

export function Workouts() {
  const s = useWorkoutsPageState();
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
    <PullToRefresh onRefresh={s.handlePullRefresh} variant="fizruk">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
        <div className="flex items-center gap-3 mb-3">
          {s.view !== "home" ? (
            <button
              type="button"
              className="w-9 h-9 -ml-1 rounded-xl flex items-center justify-center text-text/80 hover:bg-surface-2"
              onClick={s.goHome}
              aria-label="Повернутись до тренувань"
            >
              ‹
            </button>
          ) : null}
          <div className="flex-1">
            <h1 className="text-style-title text-text">
              {s.view === "catalog"
                ? "Каталог вправ"
                : s.view === "templates"
                  ? "Шаблони"
                  : s.view === "log"
                    ? s.activeWorkout && !s.activeWorkout.endedAt
                      ? "Активне тренування"
                      : "Журнал"
                    : "Тренування"}
            </h1>
            {s.view === "home" ? (
              <p className="text-xs text-subtle mt-0.5">
                {s.activeWorkout && !s.activeWorkout.endedAt
                  ? `Активне · ${(s.activeWorkout.items || []).length} вправ`
                  : s.finishedCount > 0
                    ? `Завершено: ${s.finishedCount}`
                    : "Перше тренування — попереду"}
              </p>
            ) : null}
          </div>
          {s.view === "catalog" ? (
            <Button
              size="sm"
              className="h-9 min-h-[44px] px-4"
              onClick={s.openAddSheet}
              aria-label="Додати вправу в каталог"
            >
              + Додати
            </Button>
          ) : null}
        </div>

        {s.view === "home" ? (
          <WorkoutsHome
            activeWorkout={s.activeWorkout}
            activeDuration={s.activeDuration}
            recentWorkouts={s.recentWorkouts}
            onOpenSession={s.goLog}
            onOpenCatalog={s.goCatalog}
            onOpenTemplates={s.goTemplates}
            onOpenJournal={s.goLog}
            onRequestStart={s.openQuickStart}
            onOpenRetro={s.openRetroFromHome}
          />
        ) : null}

        {s.view === "log" && (
          // DataState contract: `data === undefined` triggers the skeleton
          // slot. `useWorkouts` flips `loaded` from false → true after one
          // tick on mount (it rehydrates from `localStorage` / SQLite),
          // so on first paint we feed `data: undefined` and from the
          // second tick onwards `data` is the real list — even when it
          // happens to be empty. This prevents the "порожньо" empty-state
          // inside `WorkoutJournalSection` from flashing during hydration.
          <DataState query={s.journalQuery} skeleton={workoutsLoadingSkeleton}>
            {() => (
              <WorkoutJournalSection
                activeWorkout={s.activeWorkout}
                activeDuration={s.activeDuration}
                workouts={s.workouts}
                activeWorkoutId={s.activeWorkoutId}
                setActiveWorkoutId={s.setActiveWorkoutId}
                retroOpen={s.retroOpen}
                setRetroOpen={s.setRetroOpen}
                retroDate={s.retroDate}
                setRetroDate={s.setRetroDate}
                retroTime={s.retroTime}
                setRetroTime={s.setRetroTime}
                createWorkout={s.createWorkout}
                setMode={s.setView}
                musclesUk={s.musclesUk}
                recBy={s.rec.by}
                lastByExerciseId={s.lastByExerciseId}
                setRestTimer={s.setRestTimer}
                updateWorkout={s.updateWorkout}
                updateItem={s.updateItem}
                removeItem={s.removeItemWithUndo}
                setFinishFlash={s.setFinishFlash}
                endWorkout={s.endWorkout}
                summarizeWorkoutForFinish={summarizeWorkoutForFinish}
                submitRetroWorkout={s.submitRetroWorkout}
                deleteWorkout={s.deleteWorkout}
                restoreWorkout={s.restoreWorkout}
              />
            )}
          </DataState>
        )}

        {s.view === "templates" && (
          <WorkoutTemplatesSection
            exercises={s.exercises}
            search={s.search}
            templates={s.templateApi.templates}
            addTemplate={s.templateApi.addTemplate}
            updateTemplate={s.templateApi.updateTemplate}
            removeTemplate={s.templateApi.removeTemplate}
            restoreTemplate={s.templateApi.restoreTemplate}
            onStartTemplate={s.startWorkoutFromTemplate}
          />
        )}

        {(s.view === "catalog" || s.view === "log") && (
          <WorkoutCatalogSection
            mode={s.mode}
            q={s.q}
            setQ={s.setQ}
            equipmentFilter={s.equipmentFilter}
            setEquipmentFilter={s.setEquipmentFilter}
            equipmentUk={s.equipmentUk}
            grouped={s.grouped}
            open={s.open}
            setOpen={s.setOpen}
            handleExerciseInListClick={s.handleExerciseInListClick}
            setSelected={s.setSelected}
            recoveryConflictsForExercise={recoveryConflictsForExercise}
            rec={s.rec}
            musclesUk={s.musclesUk}
          />
        )}

        <ExerciseDetailSheet
          selected={s.selected}
          onClose={s.onSelectedSheetClose}
          mode={s.mode}
          musclesUk={s.musclesUk}
          rec={s.rec}
          recoveryConflictsForExercise={recoveryConflictsForExercise}
          activeWorkoutId={s.activeWorkoutId}
          activeWorkout={s.activeWorkout}
          addExerciseToActive={s.addExerciseToActive}
          onDeleteRequest={s.onRequestDeleteExercise}
          toast={s.toast}
        />

        <AddExerciseSheet
          open={s.addOpen}
          onClose={s.closeAddSheet}
          form={s.form}
          setForm={s.setForm}
          primaryGroupsUk={s.primaryGroupsUk}
          musclesUk={s.musclesUk}
          musclesByPrimaryGroup={s.musclesByPrimaryGroup}
          addExercise={s.addExercise}
        />

        <QuickStartSheet
          open={s.quickStartOpen}
          onClose={s.closeQuickStart}
          exercises={s.exercises}
          search={s.search}
          primaryGroupsUk={s.primaryGroupsUk}
          onPickTemplate={s.onPickTemplateFromQuickStart}
          onConfirmExercises={s.confirmQuickStartExercises}
        />

        <RestTimerOverlay
          restTimer={s.restTimer}
          onCancel={s.cancelRestTimer}
        />

        <WorkoutFinishSheets
          finishFlash={s.finishFlash}
          setFinishFlash={s.setFinishFlash}
          updateWorkout={s.updateWorkout}
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
        open={s.deleteExerciseConfirm}
        title="Видалити вправу?"
        description="Вправу буде видалено з каталогу. Записи в тренуваннях залишаться."
        confirmLabel="Видалити"
        onConfirm={s.confirmDeleteSelectedExercise}
        onCancel={s.dismissDeleteExerciseConfirm}
      />

      <ConfirmDialog
        open={!!s.riskyTemplateConfirm}
        title="М'язи ще відновлюються"
        description="У шаблоні є вправи на групи м'язів, які ще не відновились. Почати тренування все одно?"
        confirmLabel="Так, почати"
        cancelLabel="Скасувати"
        danger={false}
        onConfirm={s.confirmRiskyTemplateStart}
        onCancel={s.dismissRiskyTemplateConfirm}
      />
    </PullToRefresh>
  );
}
