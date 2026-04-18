import { useMemo } from "react";
import { habitCompletionRate } from "../lib/streaks.js";
import { Card } from "@shared/components/ui/Card";

export function HabitLeadersBlock({ habits, completions }) {
  const { best, worst } = useMemo(() => {
    const active = habits.filter((h) => !h.archived);
    if (active.length === 0) return { best: null, worst: null };

    const rates = active
      .map((h) => {
        const r = habitCompletionRate(h, completions[h.id] || [], 30);
        return { habit: h, ...r };
      })
      .filter((r) => r.scheduled > 0);

    if (rates.length === 0) return { best: null, worst: null };

    rates.sort((a, b) => b.rate - a.rate);
    const best = rates[0];
    const worst = rates.length > 1 ? rates[rates.length - 1] : null;

    if (worst && worst.habit.id === best.habit.id) return { best, worst: null };

    return { best, worst };
  }, [habits, completions]);

  if (!best) return null;

  return (
    <Card radius="lg">
      <p className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
        Лідери та аутсайдери (30 днів)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-routine-line/40 dark:border-routine/20 bg-routine-surface/30 dark:bg-routine/8 p-3">
          <p className="text-2xs uppercase tracking-wide text-subtle mb-1">
            Найстабільніша
          </p>
          <p className="text-sm font-semibold text-text truncate">
            {best.habit.emoji} {best.habit.name}
          </p>
          <p className="text-xs text-subtle mt-0.5 tabular-nums">
            {Math.round(best.rate * 100)}% · {best.completed}/{best.scheduled}
          </p>
        </div>
        {worst && (
          <div className="rounded-xl border border-line bg-panel p-3">
            <p className="text-2xs uppercase tracking-wide text-subtle mb-1">
              Найслабша
            </p>
            <p className="text-sm font-semibold text-text truncate">
              {worst.habit.emoji} {worst.habit.name}
            </p>
            <p className="text-xs text-subtle mt-0.5 tabular-nums">
              {Math.round(worst.rate * 100)}% · {worst.completed}/
              {worst.scheduled}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
