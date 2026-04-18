import { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { ProgressRing } from "@shared/components/ui/ProgressRing";
import { Icon } from "@shared/components/ui/Icon";
import { safeReadLS, safeWriteLS, safeRemoveLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { HubRecommendations } from "./HubRecommendations.jsx";
import { WeeklyDigestCard } from "./WeeklyDigestCard.jsx";
import { CoachInsightCard } from "./CoachInsightCard.jsx";
import { DailyFinykSummaryCard } from "./DailyFinykSummaryCard.jsx";
import { useWeeklyDigest, loadDigest, getWeekKey } from "./useWeeklyDigest.js";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DASHBOARD_ORDER_KEY = STORAGE_KEYS.DASHBOARD_ORDER;
const DEFAULT_ORDER = ["finyk", "fizruk", "routine", "nutrition"];
const HUB_PREFS_KEY = STORAGE_KEYS.HUB_PREFS;

function loadOrder() {
  const saved = safeReadLS(DASHBOARD_ORDER_KEY, null);
  if (
    Array.isArray(saved) &&
    saved.length === DEFAULT_ORDER.length &&
    DEFAULT_ORDER.every((id) => saved.includes(id))
  ) {
    return saved;
  }
  return [...DEFAULT_ORDER];
}

function saveOrder(order) {
  safeWriteLS(DASHBOARD_ORDER_KEY, order);
}

export function resetDashboardOrder() {
  safeRemoveLS(DASHBOARD_ORDER_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONFIGURATIONS — Updated with new brand colors
// ═══════════════════════════════════════════════════════════════════════════
const MODULE_CONFIGS = {
  finyk: {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M6 12h.01M6 16h.01M10 8h8M10 12h8M10 16h8" />
      </svg>
    ),
    label: "Фінік",
    module: "finyk",
    colorClass: "bg-finyk-soft text-finyk",
    borderClass: "border-brand-200/60",
    hoverGradient: "from-brand-50 to-teal-50/50",
    ringVariant: "finyk",
    description: "Транзакції та бюджети",
    getPreview: () => {
      // Quick finance preview from localStorage
      try {
        const data = localStorage.getItem("finyk_quick_stats");
        if (data) {
          const stats = JSON.parse(data);
          return {
            main: stats.todaySpent
              ? `${stats.todaySpent.toLocaleString()} грн`
              : null,
            sub: stats.budgetLeft
              ? `Залишок: ${stats.budgetLeft.toLocaleString()}`
              : null,
          };
        }
      } catch {}
      return { main: null, sub: "Відстежуй витрати" };
    },
  },
  fizruk: {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 6.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0" />
        <path d="M3 20v-1a7 7 0 0 1 7-7" />
        <path d="M14 14l2 2 4-4" />
      </svg>
    ),
    label: "Фізрук",
    module: "fizruk",
    colorClass: "bg-fizruk-soft text-fizruk",
    borderClass: "border-teal-200/60",
    hoverGradient: "from-teal-50 to-brand-50/50",
    ringVariant: "fizruk",
    description: "Тренування та прогрес",
    getPreview: () => {
      try {
        const data = localStorage.getItem("fizruk_quick_stats");
        if (data) {
          const stats = JSON.parse(data);
          return {
            main: stats.weekWorkouts ? `${stats.weekWorkouts} тренувань` : null,
            sub: stats.streak ? `Серія: ${stats.streak} днів` : null,
          };
        }
      } catch {}
      return { main: null, sub: "Плануй тренування" };
    },
  },
  routine: {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    label: "Рутина",
    module: "routine",
    colorClass: "bg-routine-surface text-routine",
    borderClass: "border-coral-200/60",
    hoverGradient: "from-coral-50 to-routine-surface/50",
    ringVariant: "routine",
    description: "Звички та щоденні цілі",
    getPreview: () => {
      try {
        const data = localStorage.getItem("routine_quick_stats");
        if (data) {
          const stats = JSON.parse(data);
          return {
            main:
              stats.todayDone !== undefined
                ? `${stats.todayDone}/${stats.todayTotal}`
                : null,
            sub: stats.streak ? `Серія: ${stats.streak} днів` : null,
            progress: stats.todayTotal
              ? (stats.todayDone / stats.todayTotal) * 100
              : 0,
          };
        }
      } catch {}
      return { main: null, sub: "Формуй звички", progress: 0 };
    },
  },
  nutrition: {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 2a26.6 26.6 0 0 1 10 20c.9-6.82 1.5-9.5 4-14" />
        <path d="M16 8c4 0 6-2 6-6-4 0-6 2-6 6" />
        <path d="M17.41 3.59a10 10 0 1 0 3 3" />
      </svg>
    ),
    label: "Харчування",
    module: "nutrition",
    colorClass: "bg-nutrition-soft text-nutrition",
    borderClass: "border-lime-200/60",
    hoverGradient: "from-lime-50 to-nutrition-soft/50",
    ringVariant: "nutrition",
    description: "КБЖВ та раціон",
    getPreview: () => {
      try {
        const data = localStorage.getItem("nutrition_quick_stats");
        if (data) {
          const stats = JSON.parse(data);
          return {
            main: stats.todayCal ? `${stats.todayCal} ккал` : null,
            sub: stats.calGoal ? `Ціль: ${stats.calGoal} ккал` : null,
            progress: stats.calGoal
              ? (stats.todayCal / stats.calGoal) * 100
              : 0,
          };
        }
      } catch {}
      return { main: null, sub: "Рахуй калорії", progress: 0 };
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DAILY PROGRESS HERO — Shows overall day progress with enhanced visuals
// ═══════════════════════════════════════════════════════════════════════════
const PROGRESS_STORAGE_KEYS = [
  "routine_quick_stats",
  "nutrition_quick_stats",
  "fizruk_quick_stats",
];

function readDailyProgress() {
  let total = 0;
  let completed = 0;

  try {
    const routineData = localStorage.getItem("routine_quick_stats");
    if (routineData) {
      const stats = JSON.parse(routineData);
      total += stats.todayTotal || 0;
      completed += stats.todayDone || 0;
    }
  } catch {
    /* ignore */
  }

  try {
    const nutritionData = localStorage.getItem("nutrition_quick_stats");
    if (nutritionData) {
      const stats = JSON.parse(nutritionData);
      if (stats.calGoal) {
        total += 1;
        if (stats.todayCal >= stats.calGoal * 0.8) completed += 1;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const fizrukData = localStorage.getItem("fizruk_quick_stats");
    if (fizrukData) {
      const stats = JSON.parse(fizrukData);
      if (stats.plannedToday) {
        total += 1;
        if (stats.completedToday) completed += 1;
      }
    }
  } catch {
    /* ignore */
  }

  return { total: total || 4, completed };
}

function DailyProgressHero() {
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

    // Cross-tab + cross-module sync: when any module updates its quick-stats
    // cache via localStorage, the hero reflects it without a full re-mount.
    const onStorage = (e) => {
      if (!e.key || PROGRESS_STORAGE_KEYS.includes(e.key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => refresh();
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
        {/* Progress Ring — glow comes from ProgressRing itself */}
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

        {/* Text content with enhanced typography */}
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

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CARD — Interactive card with preview data and enhanced visuals
// ═══════════════════════════════════════════════════════════════════════════
function ModuleCard({ config, onClick, dragProps, isDragging }) {
  const preview = config.getPreview();

  // Module-specific gradient classes
  const moduleGradients = {
    finyk: "module-card-finyk",
    fizruk: "module-card-fizruk",
    routine: "module-card-routine",
    nutrition: "module-card-nutrition",
  };

  const moduleGlows = {
    finyk: "hover-glow",
    fizruk: "hover-glow-teal",
    routine: "hover-glow-coral",
    nutrition: "hover-glow-lime",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left",
        "p-4 rounded-2xl border",
        "shadow-card transition-all duration-200 ease-smooth",
        "hover:shadow-float hover:-translate-y-1",
        "active:scale-[0.97] active:shadow-card",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        moduleGradients[config.module] || "bg-panel",
        moduleGlows[config.module],
        isDragging &&
          "opacity-80 scale-[0.97] shadow-float z-50 cursor-grabbing rotate-1",
      )}
      {...dragProps}
    >
      <div className="relative">
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              "transition-transform duration-200 ease-smooth",
              "group-hover:scale-105",
              "shadow-sm",
              config.colorClass,
            )}
          >
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              {config.label}
            </span>
          </div>
          <div
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              "bg-line/30 dark:bg-white/5",
              "group-hover:bg-line/50 dark:group-hover:bg-white/10",
              "transition-all duration-200",
              "group-hover:translate-x-0.5",
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted group-hover:text-text transition-colors"
              aria-hidden
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>

        {/* Preview content */}
        <div className="space-y-1.5">
          {preview.main ? (
            <>
              <p className="text-xl font-bold text-text tabular-nums leading-tight">
                {preview.main}
              </p>
              {preview.sub && (
                <p className="text-xs text-muted leading-snug">{preview.sub}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted leading-snug">
              {preview.sub || config.description}
            </p>
          )}

          {/* Mini progress bar */}
          {preview.progress !== undefined && preview.progress > 0 && (
            <div className="mt-2.5 h-1.5 rounded-full bg-line/40 dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  config.module === "routine" && "bg-routine",
                  config.module === "nutrition" && "bg-nutrition",
                  config.module === "fizruk" && "bg-fizruk",
                  config.module === "finyk" && "bg-finyk",
                )}
                style={{ width: `${Math.min(preview.progress, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SORTABLE CARD WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
function SortableCard({ id, onOpenModule }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cfg = MODULE_CONFIGS[id];
  if (!cfg) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <ModuleCard
        config={cfg}
        onClick={() => onOpenModule(id)}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MONDAY AUTO DIGEST HOOK
// ═══════════════════════════════════════════════════════════════════════════
function useMondayAutoDigest() {
  const { generate } = useWeeklyDigest();

  useEffect(() => {
    const now = new Date();
    const isMonday = now.getDay() === 1;
    if (!isMonday) return;

    const weekKey = getWeekKey(now);
    const existing = loadDigest(weekKey);
    if (existing) return;

    const timer = setTimeout(() => {
      generate();
    }, 3000);
    return () => clearTimeout(timer);
  }, [generate]);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HUB DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function HubDashboard({ onOpenModule, onOpenChat }) {
  const [order, setOrder] = useState(loadOrder);
  useMondayAutoDigest();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setOrder((prev) => {
        const oldIndex = prev.indexOf(active.id);
        const newIndex = prev.indexOf(over.id);
        const next = arrayMove(prev, oldIndex, newIndex);
        saveOrder(next);
        return next;
      });
    }
  }, []);

  const [showCoach, setShowCoach] = useState(
    () => safeReadLS(HUB_PREFS_KEY, {}).showCoach !== false,
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === HUB_PREFS_KEY || e.key === null) {
        setShowCoach(safeReadLS(HUB_PREFS_KEY, {}).showCoach !== false);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className="space-y-5">
      {/* Daily Progress Hero */}
      <DailyProgressHero />

      {/* Daily Finyk Summary (today's spend + top category, soft reminders) */}
      <DailyFinykSummaryCard />

      {/* Smart Recommendations */}
      <HubRecommendations onOpenModule={onOpenModule} />

      {/* AI Coach Insight */}
      {showCoach && <CoachInsightCard onOpenChat={onOpenChat} />}

      {/* Weekly Digest */}
      <WeeklyDigestCard />

      {/* Module Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Модулі
          </h2>
          <span className="text-[10px] text-subtle">
            Утримуй, щоб переставити
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 stagger-enter">
              {order.map((id) => (
                <SortableCard key={id} id={id} onOpenModule={onOpenModule} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}
