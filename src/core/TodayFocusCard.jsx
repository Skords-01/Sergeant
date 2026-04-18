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

const MODULE_CTA = {
  finyk: "Відкрити Фінік",
  fizruk: "Відкрити Фізрук",
  routine: "Відкрити Рутину",
  nutrition: "Відкрити Харчування",
  hub: "Подивитись",
};

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
  return (
    <div
      className={cn(
        "rounded-2xl border border-line/60 bg-panel p-4",
        "flex items-center gap-3",
      )}
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-brand-100/70 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
        <Icon name="check" size={18} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text leading-snug">
          Сьогодні нічого термінового
        </p>
        <p className="text-xs text-muted mt-0.5 leading-snug">
          Все зафіксовано. Переглянь тижневий прогрес або відкрий модуль.
        </p>
      </div>
      {onOpenReports && (
        <button
          type="button"
          onClick={onOpenReports}
          className={cn(
            "shrink-0 text-xs font-semibold text-muted hover:text-text",
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
export function TodayFocusCard({ focus, onAction, onDismiss, onOpenReports }) {
  if (!focus) {
    return <EmptyFocus onOpenReports={onOpenReports} />;
  }

  const accent = MODULE_ACCENT[focus.module] || "bg-primary";
  const cta = MODULE_CTA[focus.module] || "Відкрити";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line/60 bg-panel",
        "shadow-card p-4",
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
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
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
