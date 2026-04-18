import { useRef } from "react";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { cn } from "@shared/lib/cn";
import { ROUTINE_THEME as C } from "../lib/routineConstants.js";

export function DayReportSheet({
  open,
  onClose,
  dayLabel,
  scheduledHabits,
  onToggleHabit,
  dateKey,
}) {
  const ref = useRef(null);
  useDialogFocusTrap(open, ref, { onEscape: onClose });

  if (!open) return null;

  const done = scheduledHabits.filter((h) => h.completed);
  const missed = scheduledHabits.filter((h) => !h.completed);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-report-title"
        className={cn(
          "relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0",
          "bg-panel rounded-3xl shadow-float border border-line p-5",
          "animate-in slide-in-from-bottom-4 duration-200",
          "max-h-[80vh] overflow-y-auto",
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="day-report-title"
            className="text-[17px] font-bold text-text leading-snug"
          >
            Денний звіт
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-panelHi transition-colors"
            aria-label="Закрити"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-subtle mb-4">{dayLabel}</p>

        {scheduledHabits.length === 0 && (
          <p className="text-sm text-muted text-center py-6">
            На цей день немає запланованих звичок
          </p>
        )}

        {done.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-2">
              Виконано ({done.length})
            </p>
            <ul className="space-y-1.5">
              {done.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl bg-routine-surface/40 dark:bg-routine/10 border border-routine-line/30 dark:border-routine/20 px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onToggleHabit(h.id, dateKey)}
                    className={cn(
                      "w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-bold shrink-0 transition-colors",
                      C.done,
                    )}
                    aria-label="Скасувати виконання"
                  >
                    ✓
                  </button>
                  <span className="text-sm font-medium text-text truncate">
                    {h.emoji} {h.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {missed.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-2">
              Пропущено ({missed.length})
            </p>
            <ul className="space-y-1.5">
              {missed.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl bg-panel border border-line/50 px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onToggleHabit(h.id, dateKey)}
                    className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-sm font-bold shrink-0 text-muted hover:bg-panelHi transition-colors"
                    aria-label="Відмітити як виконано"
                  >
                    ○
                  </button>
                  <span className="text-sm font-medium text-muted truncate">
                    {h.emoji} {h.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {scheduledHabits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-line/50 text-center">
            <p className="text-xs text-subtle">
              {done.length} з {scheduledHabits.length} виконано
              {scheduledHabits.length > 0 && (
                <span className="ml-1 font-semibold text-text">
                  ({Math.round((done.length / scheduledHabits.length) * 100)}%)
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
