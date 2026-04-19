import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { generateRecommendations } from "./lib/recommendationEngine.js";

// Reuse the same dismissed-map key HubRecommendations used so user
// dismissals remain stable across the redesign.
const DISMISSED_KEY = "hub_recs_dismissed_v1";

const MODULE_ACCENT = {
  finyk: "bg-finyk",
  fizruk: "bg-fizruk",
  routine: "bg-routine",
  nutrition: "bg-nutrition",
  hub: "bg-primary",
};

// Subtle module-tinted background wash for the primary hero card. Uses the
// low-saturation "soft"/"surface" color tokens defined in tailwind.config;
// opacity is tuned so the card dominates without fighting dark mode.
const MODULE_WASH = {
  finyk: "bg-finyk-soft/60 dark:bg-finyk-soft/10",
  fizruk: "bg-fizruk-soft/60 dark:bg-fizruk-soft/10",
  routine: "bg-routine-surface/60 dark:bg-routine-surface/20",
  nutrition: "bg-nutrition-soft/60 dark:bg-nutrition-soft/10",
  hub: "bg-panelHi",
};

const MODULE_CTA = {
  finyk: "Відкрити Фінік",
  fizruk: "Відкрити Фізрук",
  routine: "Відкрити Рутину",
  nutrition: "Відкрити Харчування",
  hub: "Подивитись",
};

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Derive a single "reward" line for the empty focus state from the latest
 * quick-stats each module writes to localStorage. Priority:
 *   1. longest active streak (habits > training)
 *   2. today's habit completion ratio (if any progress made)
 *   3. nutrition on-goal today
 *   4. fallback neutral message
 */
function deriveRewardSignal() {
  const routine = readJSON("routine_quick_stats") || {};
  const fizruk = readJSON("fizruk_quick_stats") || {};
  const nutrition = readJSON("nutrition_quick_stats") || {};

  const streaks = [
    { module: "routine", days: Number(routine.streak) || 0 },
    { module: "fizruk", days: Number(fizruk.streak) || 0 },
  ]
    .filter((s) => s.days >= 2)
    .sort((a, b) => b.days - a.days);

  if (streaks.length > 0) {
    const top = streaks[0];
    return {
      line: `Серія ${top.days} днів досі`,
      module: top.module,
    };
  }

  if (routine.todayTotal > 0 && routine.todayDone > 0) {
    return {
      line: `Звички сьогодні: ${routine.todayDone}/${routine.todayTotal}`,
      module: "routine",
    };
  }

  if (
    nutrition.calGoal &&
    nutrition.todayCal &&
    nutrition.todayCal <= nutrition.calGoal
  ) {
    return {
      line: `Уклався в ціль по калоріях: ${nutrition.todayCal}/${nutrition.calGoal} ккал`,
      module: "nutrition",
    };
  }

  return null;
}

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDismissed(map) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Hook that exposes the current dashboard focus (= top recommendation) plus
 * the rest of the visible recommendations, sharing dismiss state with the
 * unified insights panel.
 */
export function useDashboardFocus() {
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const recs = generateRecommendations();

  const visible = useMemo(
    () => recs.filter((r) => !dismissed[r.id]),
    [recs, dismissed],
  );

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: Date.now() };
      saveDismissed(next);
      return next;
    });
  }, []);

  return {
    focus: visible[0] || null,
    rest: visible.slice(1),
    dismiss,
  };
}

function EmptyFocus({ onOpenReports }) {
  const reward = deriveRewardSignal();
  const washClass = reward ? MODULE_WASH[reward.module] : null;
  const accentClass = reward ? MODULE_ACCENT[reward.module] : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-panel p-4",
        "flex items-center gap-3",
        washClass,
      )}
    >
      {accentClass && (
        <div
          className={cn(
            "absolute left-0 top-4 bottom-4 w-1 rounded-r-full",
            accentClass,
          )}
          aria-hidden
        />
      )}
      <div
        className={cn(
          "relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          reward
            ? "bg-panel/70 text-text"
            : "bg-brand-100/70 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400",
        )}
      >
        <Icon name={reward ? "sparkle" : "check"} size={18} strokeWidth={2.5} />
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="text-sm font-semibold text-text leading-snug">
          {reward ? "Ти в грі" : "Сьогодні нічого термінового"}
        </p>
        <p className="text-xs text-muted mt-0.5 leading-snug">
          {reward
            ? reward.line
            : "Все зафіксовано. Переглянь тижневий прогрес або відкрий модуль."}
        </p>
      </div>
      {onOpenReports && (
        <button
          type="button"
          onClick={onOpenReports}
          className={cn(
            "relative shrink-0 text-xs font-semibold text-muted hover:text-text",
            "px-2.5 py-1.5 rounded-lg hover:bg-panelHi transition-colors",
          )}
        >
          Звіти →
        </button>
      )}
    </div>
  );
}

/**
 * Primary hero on the dashboard: shows a single next-best-action derived from
 * the recommendation engine, or a neutral empty state. Replaces the old
 * decorative DailyProgressHero.
 */
export function TodayFocusCard({
  focus,
  onAction,
  onDismiss,
  onOpenReports,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  focus: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction: (module: any) => void;
  onDismiss: (id: string) => void;
  onOpenReports?: () => void;
}) {
  if (!focus) {
    return <EmptyFocus onOpenReports={onOpenReports} />;
  }

  const accent = MODULE_ACCENT[focus.module] || "bg-primary";
  const wash = MODULE_WASH[focus.module] || "bg-panelHi";
  const cta = MODULE_CTA[focus.module] || "Відкрити";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-panel",
        "shadow-card p-4",
        wash,
      )}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute left-0 top-4 bottom-4 w-1 rounded-r-full",
          accent,
        )}
        aria-hidden
      />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-3 mb-1">
          <span className="text-2xs font-semibold uppercase tracking-widest text-muted">
            Зараз
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(focus.id)}
              aria-label="Відкласти"
              title="Відкласти"
              className={cn(
                "shrink-0 w-7 h-7 -mr-1 -mt-1 rounded-lg flex items-center justify-center",
                "text-muted hover:text-text hover:bg-panelHi transition-colors",
              )}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <h2 className="text-base font-bold text-text leading-snug text-balance">
          {focus.icon && (
            <span className="mr-1.5" aria-hidden>
              {focus.icon}
            </span>
          )}
          {focus.title}
        </h2>

        {focus.body && (
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {focus.body}
          </p>
        )}

        {focus.action && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAction(focus.action)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                "bg-primary text-bg text-xs font-semibold",
                "hover:brightness-110 active:scale-[0.98] transition-all",
              )}
            >
              {cta}
              <Icon name="chevron-right" size={14} strokeWidth={2.5} />
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(focus.id)}
                className={cn(
                  "text-xs font-medium text-muted hover:text-text",
                  "px-2.5 py-1.5 rounded-lg hover:bg-panelHi transition-colors",
                )}
              >
                Пізніше
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
