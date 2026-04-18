import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { generateRecommendations } from "./lib/recommendationEngine.js";

const DISMISSED_KEY = "hub_recs_dismissed_v1";

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

const MODULE_COLORS = {
  finyk:
    "border-brand-200/60 bg-gradient-to-br from-brand-50/80 to-teal-50/40 dark:from-brand-900/20 dark:to-teal-900/10 dark:border-brand-700/30",
  fizruk:
    "border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-cyan-50/40 dark:from-teal-900/20 dark:to-cyan-900/10 dark:border-teal-700/30",
  routine:
    "border-coral-200/60 bg-gradient-to-br from-red-50/80 to-orange-50/40 dark:from-red-900/20 dark:to-orange-900/10 dark:border-coral-700/30",
  nutrition:
    "border-lime-200/60 bg-gradient-to-br from-lime-50/80 to-green-50/40 dark:from-lime-900/20 dark:to-green-900/10 dark:border-lime-700/30",
};

export function HubRecommendations({ onOpenModule }) {
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [expanded, setExpanded] = useState(false);
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

  const shown = expanded ? visible : visible.slice(0, 2);

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: Date.now() };
      saveDismissed(next);
      return next;
    });
  }, []);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Рекомендації
        </h2>
        {visible.length > 1 && (
          <span className="text-[10px] text-subtle bg-panelHi px-2 py-0.5 rounded-full">
            {visible.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {shown.map((rec) => (
          <RecCard
            key={rec.id}
            rec={rec}
            onDismiss={() => dismiss(rec.id)}
            onAction={() => rec.action && onOpenModule(rec.action)}
          />
        ))}
      </div>

      {visible.length > 2 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-center text-xs text-muted hover:text-text py-1.5 transition-colors"
        >
          Показати ще {visible.length - 2}
        </button>
      )}
      {expanded && visible.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full text-center text-xs text-muted hover:text-text py-1.5 transition-colors"
        >
          Згорнути
        </button>
      )}
    </div>
  );
}

function RecCard({ rec, onDismiss, onAction }) {
  const colorClass =
    MODULE_COLORS[rec.module] || "border-line/40 bg-panelHi/30";

  const moduleAccent = {
    finyk:
      "text-brand-600 dark:text-brand-400 hover:bg-brand-100/50 dark:hover:bg-brand-900/30",
    fizruk:
      "text-teal-600 dark:text-teal-400 hover:bg-teal-100/50 dark:hover:bg-teal-900/30",
    routine:
      "text-coral-600 dark:text-coral-400 hover:bg-coral-100/50 dark:hover:bg-coral-900/30",
    nutrition:
      "text-lime-600 dark:text-lime-400 hover:bg-lime-100/50 dark:hover:bg-lime-900/30",
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 py-3.5 rounded-2xl border",
        "shadow-card transition-all duration-200 ease-smooth",
        "hover:shadow-float hover:-translate-y-0.5",
        colorClass,
      )}
    >
      {/* Icon with background */}
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          "bg-white/60 dark:bg-white/10",
          "shadow-sm",
        )}
      >
        <span className="text-base" aria-hidden>
          {rec.icon}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text leading-snug">
          {rec.title}
        </p>
        {rec.body && (
          <p className="text-xs text-muted mt-1 leading-relaxed">{rec.body}</p>
        )}
        {rec.action && (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg",
              "text-[11px] font-semibold",
              "transition-all duration-200",
              moduleAccent[rec.module] || "text-primary hover:bg-panelHi",
            )}
          >
            Відкрити
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Сховати"
        className={cn(
          "shrink-0 w-7 h-7 flex items-center justify-center rounded-lg",
          "text-muted hover:text-text hover:bg-white/50 dark:hover:bg-white/10",
          "transition-all duration-200 self-start",
          "opacity-60 group-hover:opacity-100",
        )}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
