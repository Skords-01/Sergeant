import { useEffect, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { useWaterTracker } from "../hooks/useWaterTracker.js";
import { Card } from "@shared/components/ui/Card";

const QUICK_ML = [200, 300, 500, 750];

function fmt(ml) {
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)} л` : `${ml} мл`;
}

export function WaterTrackerCard({ goalMl = 2000 }) {
  const { todayMl, add, reset } = useWaterTracker();
  const [resetPending, setResetPending] = useState(false);
  const resetTimerRef = useRef(null);

  const pct = goalMl > 0 ? Math.min(100, (todayMl / goalMl) * 100) : 0;
  const done = todayMl >= goalMl && goalMl > 0;

  useEffect(() => {
    // Очищуємо pending-таймер при unmount, щоб не тригернути setState на
    // розмонтованому компоненті.
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  return (
    <Card radius="lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none" aria-hidden="true">
            💧
          </span>
          <div>
            <div className="text-sm font-semibold text-text leading-none">
              Вода
            </div>
            <div className="text-xs text-subtle mt-0.5">
              {fmt(todayMl)}
              {goalMl > 0 && ` / ${fmt(goalMl)}`}
              {done && <span aria-hidden="true"> ✓</span>}
            </div>
          </div>
        </div>
        {todayMl > 0 && (
          <button
            type="button"
            onClick={() => {
              if (resetPending) {
                if (resetTimerRef.current !== null) {
                  clearTimeout(resetTimerRef.current);
                  resetTimerRef.current = null;
                }
                reset();
                setResetPending(false);
              } else {
                // Скидаємо попередній таймер, якщо користувач натиснув двічі
                // поспіль — інакше перше повернення в idle зніматиме нове pending.
                if (resetTimerRef.current !== null) {
                  clearTimeout(resetTimerRef.current);
                }
                setResetPending(true);
                resetTimerRef.current = window.setTimeout(() => {
                  setResetPending(false);
                  resetTimerRef.current = null;
                }, 2500);
              }
            }}
            className="text-xs text-subtle hover:text-danger transition-colors px-2 py-1 rounded-lg"
            aria-label={
              resetPending
                ? "Підтвердити скидання води за сьогодні"
                : "Скинути воду за сьогодні"
            }
          >
            {resetPending ? "Скинути?" : <span aria-hidden="true">↺</span>}
          </button>
        )}
      </div>

      {/* Progress bar */}
      {goalMl > 0 && (
        <div className="h-2 bg-line/30 rounded-full overflow-hidden mb-3">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              done ? "bg-success" : "bg-sky-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Quick-add buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {QUICK_ML.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => add(ml)}
            className={cn(
              "h-9 rounded-xl text-xs font-semibold transition-colors",
              "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20",
              "hover:bg-sky-500/20 active:scale-95",
            )}
          >
            +{ml < 1000 ? ml : `${ml / 1000}л`}
          </button>
        ))}
      </div>
    </Card>
  );
}
