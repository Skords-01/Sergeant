import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
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
  finyk: "border-emerald-500/20 bg-emerald-500/5",
  fizruk: "border-sky-500/20 bg-sky-500/5",
  routine: "border-orange-500/20 bg-orange-500/5",
  nutrition: "border-lime-500/20 bg-lime-500/5",
};

export function HubRecommendations({ onOpenModule }) {
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const recs = useMemo(() => generateRecommendations(), [tick]);

  const visible = useMemo(
    () => recs.filter((r) => !dismissed[r.id]),
    [recs, dismissed]
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
  const colorClass = MODULE_COLORS[rec.module] || "border-line/40 bg-panelHi/30";

  return (
    <div
      className={cn(
        "relative flex gap-3 px-3.5 py-3 rounded-2xl border",
        "shadow-card animate-in fade-in slide-in-from-top-1 duration-200",
        colorClass
      )}
    >
      <span className="text-lg shrink-0 mt-0.5" aria-hidden>
        {rec.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text leading-snug">{rec.title}</p>
        {rec.body && (
          <p className="text-xs text-muted mt-0.5 leading-relaxed">{rec.body}</p>
        )}
        {rec.action && (
          <button
            type="button"
            onClick={onAction}
            className="mt-1.5 text-[11px] font-semibold text-primary hover:underline"
          >
            Відкрити →
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Сховати"
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-line/30 transition-colors self-start mt-0.5"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
