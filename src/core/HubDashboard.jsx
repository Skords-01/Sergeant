import { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { ProgressRing } from "@shared/components/ui/ProgressRing";
import { safeReadLS, safeWriteLS, safeRemoveLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { HubRecommendations } from "./HubRecommendations.jsx";
import { WeeklyDigestCard } from "./WeeklyDigestCard.jsx";
import { CoachInsightCard } from "./CoachInsightCard.jsx";
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M6 8h.01M6 12h.01M6 16h.01M10 8h8M10 12h8M10 16h8"/>
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
            main: stats.todaySpent ? `${stats.todaySpent.toLocaleString()} грн` : null,
            sub: stats.budgetLeft ? `Залишок: ${stats.budgetLeft.toLocaleString()}` : null,
          };
        }
      } catch {}
      return { main: null, sub: "Відстежуй витрати" };
    },
  },
  fizruk: {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0"/>
        <path d="M3 20v-1a7 7 0 0 1 7-7"/>
        <path d="M14 14l2 2 4-4"/>
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="m9 12 2 2 4-4"/>
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
            main: stats.todayDone !== undefined ? `${stats.todayDone}/${stats.todayTotal}` : null,
            sub: stats.streak ? `Серія: ${stats.streak} днів` : null,
            progress: stats.todayTotal ? (stats.todayDone / stats.todayTotal) * 100 : 0,
          };
        }
      } catch {}
      return { main: null, sub: "Формуй звички", progress: 0 };
    },
  },
  nutrition: {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2a26.6 26.6 0 0 1 10 20c.9-6.82 1.5-9.5 4-14"/>
        <path d="M16 8c4 0 6-2 6-6-4 0-6 2-6 6"/>
        <path d="M17.41 3.59a10 10 0 1 0 3 3"/>
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
            progress: stats.calGoal ? (stats.todayCal / stats.calGoal) * 100 : 0,
          };
        }
      } catch {}
      return { main: null, sub: "Рахуй калорії", progress: 0 };
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DAILY PROGRESS HERO — Shows overall day progress
// ═══════════════════════════════════════════════════════════════════════════
function DailyProgressHero() {
  const [progress, setProgress] = useState({ total: 0, completed: 0 });
  
  useEffect(() => {
    // Aggregate progress from all modules
    let total = 0;
    let completed = 0;
    
    // Check routine habits
    try {
      const routineData = localStorage.getItem("routine_quick_stats");
      if (routineData) {
        const stats = JSON.parse(routineData);
        total += stats.todayTotal || 0;
        completed += stats.todayDone || 0;
      }
    } catch {}
    
    // Check nutrition goals (simplified)
    try {
      const nutritionData = localStorage.getItem("nutrition_quick_stats");
      if (nutritionData) {
        const stats = JSON.parse(nutritionData);
        if (stats.calGoal) {
          total += 1;
          if (stats.todayCal >= stats.calGoal * 0.8) completed += 1;
        }
      }
    } catch {}
    
    // Check workout for today
    try {
      const fizrukData = localStorage.getItem("fizruk_quick_stats");
      if (fizrukData) {
        const stats = JSON.parse(fizrukData);
        if (stats.plannedToday) {
          total += 1;
          if (stats.completedToday) completed += 1;
        }
      }
    } catch {}
    
    setProgress({ total: total || 4, completed });
  }, []);
  
  const percentage = progress.total > 0 
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
    <div className="relative overflow-hidden rounded-3xl bg-hub-hero border border-line shadow-card p-5">
      {/* Decorative gradient orbs */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-brand-200/20 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-teal-200/20 blur-3xl" />
      
      <div className="relative flex items-center gap-5">
        {/* Progress Ring */}
        <ProgressRing
          value={progress.completed}
          max={progress.total}
          size="lg"
          variant="brand"
          animate
        >
          <span className="text-2xl font-bold text-brand-600 tabular-nums">
            {percentage}%
          </span>
        </ProgressRing>
        
        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-0.5">
            {greeting}
          </p>
          <h1 className="text-xl font-bold text-text mb-1 text-balance">
            {motivationalText}
          </h1>
          <p className="text-sm text-muted">
            {progress.completed} з {progress.total} завдань виконано
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CARD — Interactive card with preview data
// ═══════════════════════════════════════════════════════════════════════════
function ModuleCard({
  config,
  onClick,
  dragProps,
  isDragging,
}) {
  const preview = config.getPreview();
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left",
        "p-4 rounded-2xl border bg-panel",
        "shadow-card transition-all duration-200 ease-smooth",
        "hover:shadow-float hover:-translate-y-0.5",
        "active:scale-[0.98] active:shadow-card",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2",
        config.borderClass,
        isDragging && "opacity-70 scale-[0.97] shadow-float z-50 cursor-grabbing",
      )}
      {...dragProps}
    >
      {/* Hover gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100",
          "transition-opacity duration-300 pointer-events-none",
          "bg-gradient-to-br",
          config.hoverGradient,
        )}
      />
      
      <div className="relative">
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              "transition-transform duration-200 group-hover:scale-110",
              config.colorClass,
            )}
          >
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              {config.label}
            </span>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-subtle group-hover:text-muted group-hover:translate-x-0.5 transition-all shrink-0"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
        
        {/* Preview content */}
        <div className="space-y-1">
          {preview.main ? (
            <>
              <p className="text-lg font-bold text-text tabular-nums">
                {preview.main}
              </p>
              {preview.sub && (
                <p className="text-xs text-muted">{preview.sub}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">{preview.sub || config.description}</p>
          )}
          
          {/* Mini progress bar if available */}
          {preview.progress !== undefined && preview.progress > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-line/50 overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
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
      
      {/* Smart Recommendations */}
      <HubRecommendations onOpenModule={onOpenModule} />

      {/* AI Coach Insight */}
      {showCoach && <CoachInsightCard onOpenChat={onOpenChat} />}

      {/* Weekly Digest */}
      <WeeklyDigestCard />

      {/* Module Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-text">
            Модулі
          </h2>
          <span className="text-2xs text-subtle">
            Утримуй для переміщення
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3">
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
