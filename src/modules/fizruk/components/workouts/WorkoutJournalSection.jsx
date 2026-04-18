import { Virtuoso } from "react-virtuoso";
import { Button } from "@shared/components/ui/Button";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ActiveWorkoutPanel } from "../workouts/ActiveWorkoutPanel";
import { SwipeToAction } from "@shared/components/ui/SwipeToAction";
import { SectionErrorBoundary } from "@shared/components/ui/SectionErrorBoundary.jsx";

function WorkoutRow({ w, activeWorkoutId, setActiveWorkoutId }) {
  // An ended workout is always "Завершене" — even if it happens to be the
  // currently-selected row — so it no longer looks like it's "hanging in
  // active" after the user pressed «Завершити».
  const isEnded = Boolean(w.endedAt);
  const isActive = !isEnded && activeWorkoutId === w.id;
  return (
    <button
      key={w.id}
      onClick={() => setActiveWorkoutId(w.id)}
      className={`w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors${activeWorkoutId === w.id ? " bg-text/5" : ""}`}
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
          {isEnded ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-panelHi text-subtle border border-line">
              Завершене
            </span>
          ) : isActive ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20">
              Активне
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
  );
}

const JOURNAL_ITEM_HEIGHT = 60;
const MAX_JOURNAL_HEIGHT = JOURNAL_ITEM_HEIGHT * 10;

export function WorkoutJournalSection({
  activeWorkout,
  activeDuration,
  workouts,
  activeWorkoutId,
  setActiveWorkoutId,
  retroOpen,
  setRetroOpen,
  retroDate,
  setRetroDate,
  retroTime,
  setRetroTime,
  createWorkout,
  setMode,
  musclesUk,
  recBy,
  lastByExerciseId,
  setRestTimer,
  updateWorkout,
  updateItem,
  removeItem,
  setFinishFlash,
  endWorkout,
  setDeleteWorkoutConfirm,
  summarizeWorkoutForFinish,
  submitRetroWorkout,
  deleteWorkout,
}) {
  const workoutList = workouts || [];
  const listHeight = Math.min(
    workoutList.length * JOURNAL_ITEM_HEIGHT,
    MAX_JOURNAL_HEIGHT,
  );

  return (
    <div className="space-y-3">
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
        <SectionErrorBoundary
          title="Помилка в активному тренуванні"
          resetLabel="Спробувати знову"
          onReset={() => {
            // Мінімальний безпечний reset: вихід з активної вправи-секції в UI
            setActiveWorkoutId?.(activeWorkout?.id || null);
          }}
        >
          <ActiveWorkoutPanel
            activeWorkout={activeWorkout}
            activeDuration={activeDuration}
            lastByExerciseId={lastByExerciseId}
            musclesUk={musclesUk}
            recBy={recBy}
            removeItem={removeItem}
            updateItem={updateItem}
            updateWorkout={updateWorkout}
            setRestTimer={setRestTimer}
            onFinishClick={() => {
              const sum = summarizeWorkoutForFinish(activeWorkout);
              const wid = activeWorkout.id;
              endWorkout(wid);
              // Collapse the expanded active workout panel immediately —
              // a finished session should live on in the history list as a
              // "Завершене" entry, not keep occupying the "Активне" slot.
              // The workout itself is not deleted: it can only be removed
              // via explicit delete (swipe / "Видалити" confirm dialog).
              setActiveWorkoutId(null);
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
        </SectionErrorBoundary>
      )}

      <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 py-3 bg-panelHi/60 border-b border-line flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest">
            Останні тренування
          </div>
          <button
            type="button"
            onClick={() => setRetroOpen((o) => !o)}
            className="h-8 px-2.5 rounded-lg border border-line text-xs text-subtle hover:text-text hover:bg-panel transition-colors"
            aria-expanded={retroOpen}
            title="Записати заднім числом"
          >
            •••
          </button>
        </div>

        {retroOpen && (
          <div className="px-4 py-3 border-b border-line bg-bg space-y-3">
            <p className="text-xs font-semibold text-text">
              Записати тренування заднім числом
            </p>
            <p className="text-xs text-subtle leading-relaxed">
              Вкажи, коли було тренування, потім додай вправи та заповни
              кг/повтори.
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

        {workoutList.length === 0 && (
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

        {workoutList.length > 0 && (
          <Virtuoso
            style={{ height: listHeight }}
            data={workoutList}
            itemContent={(_, w) => (
              <SwipeToAction
                key={w.id}
                onSwipeLeft={
                  deleteWorkout && w.id !== activeWorkoutId
                    ? () => deleteWorkout(w.id)
                    : undefined
                }
                rightLabel="🗑 Видалити"
                rightColor="bg-danger"
              >
                <WorkoutRow
                  w={w}
                  activeWorkoutId={activeWorkoutId}
                  setActiveWorkoutId={setActiveWorkoutId}
                />
              </SwipeToAction>
            )}
          />
        )}
      </div>
    </div>
  );
}
