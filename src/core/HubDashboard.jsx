import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { safeReadLS, safeWriteLS, safeRemoveLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { TodayFocusCard, useDashboardFocus } from "./TodayFocusCard.jsx";
import { HubInsightsPanel } from "./HubInsightsPanel.jsx";
import { WeeklyDigestCard, hasLiveWeeklyDigest } from "./WeeklyDigestCard.jsx";
import { useWeeklyDigest, loadDigest, getWeekKey } from "./useWeeklyDigest.js";
import { SoftAuthPromptCard } from "./onboarding/SoftAuthPromptCard.jsx";
import { DemoModeBanner } from "./onboarding/DemoModeBanner.jsx";
import { FirstActionHeroCard } from "./onboarding/FirstActionSheet.jsx";
import { detectFirstRealEntry } from "./onboarding/firstRealEntry.js";
import {
  isSoftAuthDismissed,
  isDemoBannerDismissed,
  dismissDemoBanner,
  isFirstActionPending,
} from "./onboarding/vibePicks.js";
import { wasDemoSeeded } from "./onboarding/demoSeeds.js";
import { useFirstEntryCelebration } from "./onboarding/useFirstEntryCelebration.js";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DASHBOARD_ORDER_KEY = STORAGE_KEYS.DASHBOARD_ORDER;
const DEFAULT_ORDER = ["finyk", "fizruk", "routine", "nutrition"];

// Public labels for each module, surfaced in Settings → "Упорядкувати модулі".
// Kept here (not in MODULE_CONFIGS) so consumers can import labels without
// pulling the full config (icons, localStorage readers, etc.).
export const DASHBOARD_MODULE_LABELS = {
  finyk: "Фінік",
  fizruk: "Фізрук",
  routine: "Рутина",
  nutrition: "Харчування",
};

export function loadDashboardOrder() {
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

export function saveDashboardOrder(order) {
  safeWriteLS(DASHBOARD_ORDER_KEY, order);
}

export function resetDashboardOrder() {
  safeRemoveLS(DASHBOARD_ORDER_KEY);
}

// Local aliases preserved so the rest of the file reads the same.
const loadOrder = loadDashboardOrder;
const saveOrder = saveDashboardOrder;

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONFIGURATIONS — calm accent-only styling
// ═══════════════════════════════════════════════════════════════════════════
const MODULE_CONFIGS = {
  finyk: {
    icon: (
      <svg
        width="16"
        height="16"
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
    iconClass: "bg-finyk-soft text-finyk",
    accentClass: "bg-finyk",
    description: "Транзакції та бюджети",
    hasGoal: false,
    getPreview: () => {
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
        width="16"
        height="16"
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
    iconClass: "bg-fizruk-soft text-fizruk",
    accentClass: "bg-fizruk",
    description: "Тренування та прогрес",
    hasGoal: false,
    getPreview: () => {
      try {
        const data = localStorage.getItem("fizruk_quick_stats");
        if (data) {
          const stats = JSON.parse(data);
          return {
            main: stats.weekWorkouts ? `${stats.weekWorkouts} трен.` : null,
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
        width="16"
        height="16"
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
    iconClass: "bg-routine-surface text-routine",
    accentClass: "bg-routine",
    description: "Звички та щоденні цілі",
    hasGoal: true,
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
        width="16"
        height="16"
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
    iconClass: "bg-nutrition-soft text-nutrition",
    accentClass: "bg-nutrition",
    description: "КБЖВ та раціон",
    hasGoal: true,
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
// DATE HEADER — replaces the decorative hero with a dense info line
// ═══════════════════════════════════════════════════════════════════════════
function DateHeader() {
  const text = useMemo(() => {
    try {
      return new Date().toLocaleDateString("uk-UA", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    } catch {
      return "";
    }
  }, []);

  return (
    <p className="px-0.5 text-xs font-medium text-muted uppercase tracking-wider">
      {text}
    </p>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE ROW — compact "Today at a glance" list item
// One icon + label, one number, one thin progress bar. Neutral text; the
// module's color shows only as a 1px leading accent, so four rows read as a
// single list rather than four competing heroes.
// ═══════════════════════════════════════════════════════════════════════════
function ModuleRow({ config, onClick, dragProps, isDragging }) {
  const preview = config.getPreview();
  const showProgress =
    config.hasGoal && preview.progress !== undefined && preview.progress > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left",
        "flex items-center gap-3 px-3 py-2.5",
        "bg-panel hover:bg-panelHi transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset",
        isDragging && "opacity-70 shadow-float z-50 cursor-grabbing",
      )}
      {...dragProps}
    >
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full",
          config.accentClass,
        )}
        aria-hidden
      />

      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          config.iconClass,
        )}
      >
        {config.icon}
      </div>

      <span className="text-xs font-semibold text-text truncate">
        {config.label}
      </span>

      <div className="ml-auto flex items-center gap-2 min-w-0">
        {showProgress && (
          <div
            className="w-12 sm:w-16 h-1 rounded-full bg-line/40 dark:bg-white/10 overflow-hidden shrink-0"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                config.accentClass,
              )}
              style={{ width: `${Math.min(preview.progress, 100)}%` }}
            />
          </div>
        )}
        {preview.main ? (
          <span className="text-sm font-semibold text-text tabular-nums truncate">
            {preview.main}
          </span>
        ) : (
          <span className="text-xs text-muted truncate">
            {preview.sub || config.description}
          </span>
        )}
        <Icon
          name="chevron-right"
          size={14}
          strokeWidth={2.5}
          className="text-muted shrink-0"
        />
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
      <ModuleRow
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
// WEEKLY DIGEST FOOTER — always-collapsed link on the dashboard. Renders a
// small "fresh" dot when a live digest exists so users still notice it
// without letting the full card hijack the primary block on Mondays.
// ═══════════════════════════════════════════════════════════════════════════
function WeeklyDigestFooter({ onExpand, fresh }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl",
        "text-xs font-medium text-muted hover:text-text",
        "hover:bg-panelHi transition-colors",
      )}
    >
      <span className="flex items-center gap-2">
        Тижневий звіт
        {fresh && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-primary"
            aria-label="Новий звіт"
          />
        )}
      </span>
      <Icon name="chevron-right" size={14} strokeWidth={2.5} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HUB DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function HubDashboard({ onOpenModule, onOpenChat, user, onShowAuth }) {
  const [order, setOrder] = useState(loadOrder);
  useMondayAutoDigest();

  // Inline FTUX hero — replaces the old post-wizard `FirstActionSheet`
  // modal. Reads the localStorage flag once; dismiss clears the flag.
  const [firstActionVisible, setFirstActionVisible] = useState(() =>
    isFirstActionPending(),
  );

  // Soft auth prompt appears only once the user has typed in real data and
  // has no account yet — an "offer to save", never a toll gate.
  const hasRealEntry = detectFirstRealEntry();
  useFirstEntryCelebration(hasRealEntry);
  const [softAuthDismissed, setSoftAuthDismissed] = useState(() =>
    isSoftAuthDismissed(),
  );
  const showSoftAuth =
    !user &&
    hasRealEntry &&
    !softAuthDismissed &&
    typeof onShowAuth === "function";

  // Demo banner: only while we're still showing seeded FTUX data and the
  // user hasn't contributed anything of their own yet. Dismissible; once
  // there's a real entry or the user closes it, it stays gone.
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(() =>
    isDemoBannerDismissed(),
  );
  const showDemoBanner =
    !hasRealEntry && !demoBannerDismissed && wasDemoSeeded();

  const { focus, rest, dismiss } = useDashboardFocus();

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

  const [digestExpanded, setDigestExpanded] = useState(false);
  const digestFresh = hasLiveWeeklyDigest();

  return (
    <div className="space-y-4">
      <DateHeader />

      {/* Today focus — the ONE primary action on the dashboard. Rendered
          before any banner so it is always the first thing the user sees. */}
      <TodayFocusCard
        focus={focus}
        onAction={onOpenModule}
        onDismiss={dismiss}
      />

      {/* Banner budget: one system card at a time on the dashboard.
          Priority: first-action hero (post-wizard FTUX) > demo banner >
          soft-auth nudge. Prevents the cold-start where two or three
          "meta" cards push real data below the fold. */}
      {firstActionVisible ? (
        <FirstActionHeroCard onDismiss={() => setFirstActionVisible(false)} />
      ) : showDemoBanner ? (
        <DemoModeBanner
          onDismiss={() => {
            dismissDemoBanner();
            setDemoBannerDismissed(true);
          }}
        />
      ) : showSoftAuth ? (
        <SoftAuthPromptCard
          onOpenAuth={onShowAuth}
          onDismiss={() => setSoftAuthDismissed(true)}
        />
      ) : null}

      {/* Today at a glance — compact module list (replaces the 2×2 grid) */}
      <section className="space-y-2">
        <h2 className="px-0.5 text-xs font-semibold text-muted uppercase tracking-wider">
          Сьогодні
        </h2>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="rounded-2xl border border-line bg-panel overflow-hidden divide-y divide-line/60">
              {order.map((id) => (
                <SortableCard key={id} id={id} onOpenModule={onOpenModule} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* Unified insights — collapsed by default */}
      <HubInsightsPanel
        items={rest}
        onOpenModule={onOpenModule}
        onOpenChat={onOpenChat}
        onDismiss={dismiss}
      />

      {/* Weekly digest — always a footer link on the dashboard; expands
          inline on demand. Prevents Monday auto-generation from hijacking
          the primary block. */}
      {digestExpanded ? (
        <WeeklyDigestCard />
      ) : (
        <WeeklyDigestFooter
          fresh={digestFresh}
          onExpand={() => setDigestExpanded(true)}
        />
      )}
    </div>
  );
}
