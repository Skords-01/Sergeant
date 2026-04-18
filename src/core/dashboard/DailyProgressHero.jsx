/**
 * Daily Progress Hero — aggregate progress ring shown at the top of the hub
 * dashboard.
 *
 * Listens to `storage` and `focus` events so the hero reflects updates written
 * by any module (routine, nutrition, fizruk) without a full re-mount.
 */

import { useState, useEffect, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { ProgressRing } from "@shared/components/ui/ProgressRing";
import { Icon } from "@shared/components/ui/Icon";

export const PROGRESS_STORAGE_KEYS = [
  "routine_quick_stats",
  "nutrition_quick_stats",
  "fizruk_quick_stats",
];

function parseStats(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readDailyProgress() {
  let total = 0;
  let completed = 0;

  const routine = parseStats("routine_quick_stats");
  if (routine) {
    total += routine.todayTotal || 0;
    completed += routine.todayDone || 0;
  }

  const nutrition = parseStats("nutrition_quick_stats");
  if (nutrition && nutrition.calGoal) {
    total += 1;
    if (nutrition.todayCal >= nutrition.calGoal * 0.8) completed += 1;
  }

  const fizruk = parseStats("fizruk_quick_stats");
  if (fizruk && fizruk.plannedToday) {
    total += 1;
    if (fizruk.completedToday) completed += 1;
  }

  return { total: total || 4, completed };
}

export function DailyProgressHero() {
  const [progress, setProgress] = useState(() => ({ total: 0, completed: 0 }));
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const next = readDailyProgress();
      setProgress((prev) => {
        const wasComplete = prev.completed === prev.total && prev.total > 0;
        const nowComplete = next.completed === next.total && next.total > 0;
        if (nowComplete && !wasComplete) {
          setIsComplete(true);
          setTimeout(() => setIsComplete(false), 2000);
        }
        return next;
      });
    };

    refresh();

    const onStorage = (e) => {
      if (!e.key || PROGRESS_STORAGE_KEYS.includes(e.key)) refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const percentage =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Добрий ранок";
    if (hour < 17) return "Добрий день";
    return "Добрий вечір";
  }, []);

  const motivationalText = useMemo(() => {
    if (percentage === 0) return "Час почати день!";
    if (percentage < 25) return "Гарний початок!";
    if (percentage < 50) return "Так тримати!";
    if (percentage < 75) return "Чудовий прогрес!";
    if (percentage < 100) return "Майже все!";
    return "День завершено!";
  }, [percentage]);

  return (
    <div
      role="region"
      aria-label="Прогрес дня"
      className={cn(
        "relative overflow-hidden rounded-3xl border shadow-card p-5",
        "bg-gradient-to-br from-white via-brand-50/20 to-teal-50/30",
        "dark:from-panel dark:via-panel dark:to-panel",
        "border-brand-100/60 dark:border-brand-800/30",
        "transition-all duration-500",
        isComplete && "animate-success-ring",
      )}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`${motivationalText}. Виконано ${progress.completed} з ${progress.total} завдань. ${percentage}%.`}
      </div>
      <div className="relative flex items-center gap-5">
        <div
          className={cn(
            "relative",
            percentage === 100 && "animate-celebration-pop",
          )}
        >
          <ProgressRing
            value={progress.completed}
            max={progress.total}
            size="lg"
            variant="brand"
            animate
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums leading-none">
                {percentage}%
              </span>
            </div>
          </ProgressRing>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-widest mb-1">
            {greeting}
          </p>
          <h1 className="text-xl font-bold text-text mb-1.5 text-balance leading-tight">
            {motivationalText}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted">
              <span className="font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                {progress.completed}
              </span>
              <span className="mx-1">/</span>
              <span className="tabular-nums">{progress.total}</span>
              <span className="ml-1.5">завдань</span>
            </p>
            {percentage === 100 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-[10px] font-semibold">
                <Icon name="check" size={10} strokeWidth={3} />
                Виконано
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
