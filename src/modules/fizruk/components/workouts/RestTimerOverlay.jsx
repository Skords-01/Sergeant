import { Button } from "@shared/components/ui/Button";
import { formatRestClock } from "../../lib/workoutUi";

export function RestTimerOverlay({ restTimer, onCancel }) {
  if (!restTimer) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[55] px-4 pointer-events-none fizruk-above-tabbar"
      role="timer"
      aria-live="polite"
      aria-label={`Відпочинок, залишилось ${restTimer.remaining} секунд`}
    >
      <div className="pointer-events-auto max-w-4xl mx-auto flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-float fizruk-sheet">
        <div>
          <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
            Відпочинок
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-text leading-tight">
            {formatRestClock(restTimer.remaining)}
          </div>
        </div>
        <Button
          variant="ghost"
          className="h-11 min-h-[44px] px-4"
          type="button"
          onClick={onCancel}
        >
          Скасувати
        </Button>
      </div>
    </div>
  );
}
