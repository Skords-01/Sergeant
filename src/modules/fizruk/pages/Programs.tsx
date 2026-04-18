import { useState } from "react";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { BUILTIN_PROGRAMS } from "../lib/trainingPrograms";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function Programs({
  onStartWorkout,
  activeProgramId,
  activeProgram,
  activateProgram,
  deactivateProgram,
}) {
  const { exercises } = useExerciseCatalog();
  const [expandedProgram, setExpandedProgram] = useState(null);

  const todayDayIndex = (new Date().getDay() + 6) % 7;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text">Програми</h1>
            <p className="text-xs text-subtle mt-0.5">
              {activeProgram
                ? `Активна: ${activeProgram.name}`
                : "Оберіть тренувальну програму"}
            </p>
          </div>
          {activeProgram && (
            <button
              type="button"
              onClick={deactivateProgram}
              className="h-9 px-3 rounded-xl border border-line text-xs font-semibold text-subtle hover:text-text hover:bg-panelHi transition-colors"
            >
              Зупинити
            </button>
          )}
        </div>

        <div className="space-y-3">
          {BUILTIN_PROGRAMS.map((prog) => {
            const isActive = activeProgramId === prog.id;
            const isExpanded = expandedProgram === prog.id;
            const todaySession = prog.schedule.find(
              (s) => s.day - 1 === todayDayIndex,
            );

            return (
              <div
                key={prog.id}
                className={cn(
                  "bg-panel border rounded-2xl shadow-card overflow-hidden transition-all",
                  isActive ? "border-success/60" : "border-line/60",
                )}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-text">
                          {prog.name}
                        </h2>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/25">
                            Активна
                          </span>
                        )}
                        <span className="text-[10px] text-subtle border border-line/60 rounded-full px-2 py-0.5">
                          {prog.days} дн/тиждень
                        </span>
                      </div>
                      <p className="text-xs text-subtle mt-1.5 leading-relaxed">
                        {prog.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    {Array.from({ length: 7 }, (_, i) => {
                      const hasSession = prog.schedule.some(
                        (s) => s.day - 1 === i,
                      );
                      const isToday = i === todayDayIndex;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex-1 text-center rounded py-1 text-[9px] font-bold transition-colors",
                            hasSession
                              ? isToday && isActive
                                ? "bg-success text-white"
                                : "bg-success/15 text-success"
                              : "bg-line/30 text-subtle/40",
                          )}
                        >
                          {DAY_LABELS[i]}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {!isActive ? (
                      <button
                        type="button"
                        className="flex-1 py-2.5 rounded-xl bg-success text-white text-sm font-semibold transition-all active:scale-[0.98]"
                        onClick={() => activateProgram(prog.id)}
                      >
                        Активувати
                      </button>
                    ) : (
                      <>
                        {todaySession && onStartWorkout && (
                          <button
                            type="button"
                            className="flex-1 py-2.5 rounded-xl bg-fizruk text-white text-sm font-semibold transition-all active:scale-[0.98]"
                            onClick={() => {
                              const session =
                                prog.sessions[todaySession.sessionKey];
                              onStartWorkout(session, prog);
                            }}
                          >
                            Розпочати сьогодні
                          </button>
                        )}
                        {!todaySession && (
                          <div className="flex-1 py-2.5 rounded-xl bg-panelHi text-subtle text-sm font-semibold text-center">
                            Сьогодні відпочинок
                          </div>
                        )}
                        <button
                          type="button"
                          className="py-2.5 px-4 rounded-xl border border-line text-subtle text-sm hover:text-text hover:bg-panelHi transition-colors"
                          onClick={deactivateProgram}
                        >
                          Зупинити
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="py-2.5 px-4 rounded-xl border border-line text-subtle text-sm hover:text-text hover:bg-panelHi transition-colors"
                      onClick={() =>
                        setExpandedProgram(isExpanded ? null : prog.id)
                      }
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Згорнути" : "Деталі"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <ProgramDetails prog={prog} exercises={exercises} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProgramDetails({ prog, exercises }) {
  return (
    <div className="border-t border-line/60 px-4 pb-4 pt-3 space-y-3 bg-bg/50">
      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
        Розклад та вправи
      </div>
      {prog.schedule.map((schedEntry) => {
        const session = prog.sessions[schedEntry.sessionKey];
        if (!session) return null;
        const exList = (session.exerciseIds || [])
          .map((id) => exercises.find((e) => e.id === id))
          .filter(Boolean);
        return (
          <div
            key={`${schedEntry.day}_${schedEntry.sessionKey}`}
            className="rounded-xl bg-panel border border-line/40 p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fizruk/10 text-success border border-success/20">
                День {schedEntry.day}
              </span>
              <span className="text-sm font-semibold text-text">
                {schedEntry.name}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-2 text-[10px] text-subtle">
              <span>
                Відпочинок:{" "}
                <span className="font-semibold text-text">
                  {session.defaultRestSec}с
                </span>
              </span>
              <span>
                Прогресія:{" "}
                <span className="font-semibold text-text">
                  +{session.progressionKg} кг
                </span>
              </span>
            </div>
            {exList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {exList.map((ex) => (
                  <span
                    key={ex.id}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-panelHi border border-line/60 text-subtle"
                  >
                    {ex.name?.uk || ex.name?.en || ex.id}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted italic">
                Вправи з програми відсутні в каталозі — додайте вправи з
                відповідними ID вручну.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
