import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import {
  safeReadLS,
  safeReadStringLS,
  safeWriteLS,
  safeRemoveLS,
} from "@shared/lib/storage.js";
import {
  DASHBOARD_MODULE_LABELS as SHARED_DASHBOARD_MODULE_LABELS,
  STORAGE_KEYS,
  normalizeDashboardOrder,
  selectModulePreview,
  type ModulePreview,
  type User,
} from "@sergeant/shared";
import { openHubModuleWithAction } from "@shared/lib/hubNav";
import { getModulePrimaryAction } from "@shared/lib/moduleQuickActions";
import { TodayFocusCard, useDashboardFocus } from "./TodayFocusCard.jsx";
import { HubInsightsPanel } from "./HubInsightsPanel.jsx";
import { WeeklyDigestCard, hasLiveWeeklyDigest } from "./WeeklyDigestCard.jsx";
import { useWeeklyDigest, loadDigest, getWeekKey } from "./useWeeklyDigest.js";
import { useCoachInsight } from "./useCoachInsight.js";
import { AssistantAdviceCard } from "./AssistantAdviceCard.jsx";
import { SoftAuthPromptCard } from "./onboarding/SoftAuthPromptCard.jsx";
import { FirstActionHeroCard } from "./onboarding/FirstActionSheet.jsx";
import { detectFirstRealEntry } from "./onboarding/firstRealEntry.js";
import {
  isSoftAuthDismissed,
  isFirstActionPending,
  recordSessionDay,
  getSessionDays,
  getVibePicks,
} from "./onboarding/vibePicks.js";
import { useFirstEntryCelebration } from "./onboarding/useFirstEntryCelebration.js";
import { DailyNudge } from "./onboarding/DailyNudge.jsx";
import { ReEngagementCard } from "./onboarding/ReEngagementCard.jsx";
import {
  getActiveNudge,
  shouldShowReengagement,
  recordLastActiveDate,
  countRealEntries,
  type KVStore,
} from "@sergeant/shared";
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

const localStorageStore: KVStore = {
  getString: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setString: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* noop */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  },
};

export const DASHBOARD_MODULE_LABELS = SHARED_DASHBOARD_MODULE_LABELS;

export function loadDashboardOrder() {
  return normalizeDashboardOrder(safeReadLS(DASHBOARD_ORDER_KEY, null));
}

export function saveDashboardOrder(order: string[]) {
  safeWriteLS(DASHBOARD_ORDER_KEY, order);
}

export function resetDashboardOrder() {
  safeRemoveLS(DASHBOARD_ORDER_KEY);
}

const loadOrder = loadDashboardOrder;
const saveOrder = saveDashboardOrder;

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONFIGURATIONS — bento card styling
// ═══════════════════════════════════════════════════════════════════════════
interface ModuleConfig {
  icon: ReactNode;
  label: string;
  emoji: string;
  module: string;
  iconClass: string;
  accentClass: string;
  cardBg: string;
  description: string;
  hasGoal: boolean;
  emptyLabel: string;
  getPreview: () => ModulePreview;
}

type ModuleId = "finyk" | "fizruk" | "routine" | "nutrition";

const MODULE_CONFIGS: Record<ModuleId, ModuleConfig> = {
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
    emoji: "\uD83D\uDCB0",
    module: "finyk",
    iconClass: "bg-finyk-soft text-finyk dark:bg-finyk/15",
    accentClass: "bg-finyk",
    cardBg:
      "bg-finyk-soft/40 dark:bg-finyk/8 hover:shadow-float hover:-translate-y-0.5",
    description: "Транзакції та бюджети",
    hasGoal: false,
    emptyLabel: "Почни тут \u2192",
    getPreview: () =>
      selectModulePreview(
        "finyk",
        safeReadStringLS(STORAGE_KEYS.FINYK_QUICK_STATS),
      ),
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
    emoji: "\uD83D\uDCAA",
    module: "fizruk",
    iconClass: "bg-fizruk-soft text-fizruk dark:bg-fizruk/15",
    accentClass: "bg-fizruk",
    cardBg:
      "bg-fizruk-soft/40 dark:bg-fizruk/8 hover:shadow-float hover:-translate-y-0.5",
    description: "Тренування та прогрес",
    hasGoal: false,
    emptyLabel: "Почни тут \u2192",
    getPreview: () =>
      selectModulePreview(
        "fizruk",
        safeReadStringLS(STORAGE_KEYS.FIZRUK_QUICK_STATS),
      ),
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
    emoji: "\u2705",
    module: "routine",
    iconClass: "bg-routine-surface text-routine dark:bg-routine/15",
    accentClass: "bg-routine",
    cardBg:
      "bg-routine-surface/40 dark:bg-routine/8 hover:shadow-float hover:-translate-y-0.5",
    description: "Звички та щоденні цілі",
    hasGoal: true,
    emptyLabel: "Почни тут \u2192",
    getPreview: () =>
      selectModulePreview(
        "routine",
        safeReadStringLS(STORAGE_KEYS.ROUTINE_QUICK_STATS),
      ),
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
    emoji: "\uD83E\uDD57",
    module: "nutrition",
    iconClass: "bg-nutrition-soft text-nutrition dark:bg-nutrition/15",
    accentClass: "bg-nutrition",
    cardBg:
      "bg-nutrition-soft/40 dark:bg-nutrition/8 hover:shadow-float hover:-translate-y-0.5",
    description: "КБЖВ та раціон",
    hasGoal: true,
    emptyLabel: "Почни тут \u2192",
    getPreview: () =>
      selectModulePreview(
        "nutrition",
        safeReadStringLS(STORAGE_KEYS.NUTRITION_QUICK_STATS),
      ),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// «ТВІЙ ДЕНЬ» PILL STRIP — glanceable numbers, horizontal scroll
// ═══════════════════════════════════════════════════════════════════════════
const PILL_MODULES: ModuleId[] = ["finyk", "routine", "nutrition", "fizruk"];

const PILL_ACCENT: Record<ModuleId, string> = {
  finyk: "text-finyk",
  fizruk: "text-fizruk",
  routine: "text-routine",
  nutrition: "text-nutrition",
};

function TodaySummaryStrip({
  onOpenModule,
}: {
  onOpenModule: (m: string) => void;
}) {
  const pills = useMemo(() => {
    return PILL_MODULES.map((id) => {
      const cfg = MODULE_CONFIGS[id];
      const preview = cfg.getPreview();
      return {
        id,
        label: cfg.label,
        main: preview.main,
        accent: PILL_ACCENT[id],
      };
    });
  }, []);

  const hasSomeData = pills.some((p) => p.main);
  if (!hasSomeData) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 no-scrollbar">
      {pills.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => onOpenModule(pill.id)}
          className={cn(
            "shrink-0 flex flex-col items-center rounded-2xl",
            "bg-panel border border-line px-3 py-2 min-w-[72px]",
            "transition-all active:scale-[0.97]",
            "hover:bg-panelHi hover:border-line",
          )}
        >
          <span
            className={cn(
              "text-base font-bold tabular-nums",
              pill.main ? pill.accent : "text-subtle",
            )}
          >
            {pill.main || "\u2014"}
          </span>
          <span className="text-2xs text-muted font-medium mt-0.5">
            {pill.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STREAK INDICATOR
// ═══════════════════════════════════════════════════════════════════════════
function StreakIndicator() {
  const streak = useMemo(() => {
    const routine =
      safeReadLS<Record<string, unknown>>(
        STORAGE_KEYS.ROUTINE_QUICK_STATS,
        null,
      ) ||
      (() => {
        try {
          const r = localStorage.getItem("routine_quick_stats");
          return r ? JSON.parse(r) : null;
        } catch {
          return null;
        }
      })();
    const fizruk =
      safeReadLS<Record<string, unknown>>(
        STORAGE_KEYS.FIZRUK_QUICK_STATS,
        null,
      ) ||
      (() => {
        try {
          const r = localStorage.getItem("fizruk_quick_stats");
          return r ? JSON.parse(r) : null;
        } catch {
          return null;
        }
      })();

    const streaks = [
      { days: Number(routine?.streak) || 0 },
      { days: Number(fizruk?.streak) || 0 },
    ]
      .filter((s) => s.days >= 2)
      .sort((a, b) => b.days - a.days);

    return streaks[0]?.days ?? 0;
  }, []);

  if (streak < 2) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
        "text-xs font-semibold text-text",
        "bg-panel border border-line shadow-sm",
      )}
      title="Серія днів"
    >
      <span aria-hidden>{"\uD83D\uDD25"}</span>
      {streak} {"днів поспіль"}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENTO MODULE CARD — replaces StatusRow, 2×2 grid
// ═══════════════════════════════════════════════════════════════════════════
interface BentoCardProps {
  config: ModuleConfig;
  onClick: () => void;
  onQuickAdd?: { label: string; run: () => void } | null;
  dragProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const BentoCard = memo(function BentoCard({
  config,
  onClick,
  onQuickAdd,
  dragProps,
  isDragging,
}: BentoCardProps) {
  const preview = config.getPreview();
  const showProgress =
    config.hasGoal && preview.progress !== undefined && preview.progress > 0;
  const hasData = !!(preview.main || preview.sub);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-3xl border border-line p-3.5",
        "shadow-card transition-all duration-200 text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        "active:scale-[0.98]",
        config.cardBg,
        isDragging && "opacity-70 shadow-float z-50 cursor-grabbing",
      )}
      {...dragProps}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
            config.iconClass,
          )}
        >
          {config.icon}
        </div>

        {onQuickAdd && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd.run();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onQuickAdd.run();
              }
            }}
            aria-label={onQuickAdd.label}
            title={onQuickAdd.label}
            className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center",
              "text-text bg-panel/80 hover:bg-primary hover:text-bg",
              "transition-colors",
            )}
          >
            <Icon name="plus" size={13} strokeWidth={2.5} />
          </span>
        )}
      </div>

      <span className="text-xs font-semibold text-text">
        {config.emoji} {config.label}
      </span>

      {hasData ? (
        <>
          {preview.main && (
            <span className="text-lg font-bold text-text tabular-nums mt-1 truncate">
              {preview.main}
            </span>
          )}
          {preview.sub && (
            <span className="text-2xs text-muted mt-0.5 truncate">
              {preview.sub}
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-muted mt-1">{config.emptyLabel}</span>
      )}

      {showProgress && (
        <div
          className="w-full h-1 rounded-full bg-line/40 dark:bg-white/10 overflow-hidden mt-2"
          aria-hidden
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              config.accentClass,
            )}
            style={{ width: `${Math.min(preview.progress ?? 0, 100)}%` }}
          />
        </div>
      )}
    </button>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SORTABLE BENTO CARD WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
interface SortableCardProps {
  id: ModuleId;
  onOpenModule: (id: ModuleId) => void;
  quickAdd?: { label: string; run: () => void } | null;
}

const SortableCard = memo(function SortableCard({
  id,
  onOpenModule,
  quickAdd,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  const dragProps = useMemo(
    () => ({ ...attributes, ...listeners }),
    [attributes, listeners],
  );

  const handleClick = useCallback(() => onOpenModule(id), [onOpenModule, id]);

  const cfg = MODULE_CONFIGS[id];
  if (!cfg) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <BentoCard
        config={cfg}
        onClick={handleClick}
        onQuickAdd={quickAdd}
        isDragging={isDragging}
        dragProps={dragProps}
      />
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// STAGGER WRAPPER — applies fadeSlideUp with incremental delay
// ═══════════════════════════════════════════════════════════════════════════
function StaggerChild({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    animationDelay: `${index * 50}ms`,
  };
  return (
    <div className="animate-stagger-in" style={style}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOTIVATIONAL FOOTER
// ═══════════════════════════════════════════════════════════════════════════
function MotivationalFooter() {
  const entryCount = useMemo(() => countRealEntries(localStorageStore), []);

  const message = useMemo(() => {
    if (entryCount > 0) {
      return `${entryCount === 1 ? "Вже 1 запис" : `Вже ${entryCount} записів`} \u2014 продовжуй!`;
    }
    return "Sergeant працює для тебе офлайн \uD83D\uDD12";
  }, [entryCount]);

  return <p className="text-xs text-subtle text-center py-8">{message}</p>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONDAY AUTO DIGEST HOOK
// ═══════════════════════════════════════════════════════════════════════════
function useMondayAutoDigest() {
  const { generate } = useWeeklyDigest();

  useEffect(() => {
    const enabled =
      safeReadLS<string>(STORAGE_KEYS.WEEKLY_DIGEST_MONDAY_AUTO, "") === "1";
    if (!enabled) return;

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
// WEEKLY DIGEST FOOTER
// ═══════════════════════════════════════════════════════════════════════════
function WeeklyDigestFooter({
  onExpand,
  fresh,
}: {
  onExpand: () => void;
  fresh: boolean;
}) {
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
interface HubDashboardProps {
  onOpenModule: (module: string) => void;
  onOpenChat?: () => void;
  user: User | null;
  onShowAuth: () => void;
}

export function HubDashboard({
  onOpenModule,
  onOpenChat: _onOpenChat,
  user,
  onShowAuth,
}: HubDashboardProps) {
  const [order, setOrder] = useState(loadOrder);
  useMondayAutoDigest();

  const [firstActionVisible, setFirstActionVisible] = useState(() =>
    isFirstActionPending(),
  );

  const hasRealEntry = detectFirstRealEntry();
  useFirstEntryCelebration(hasRealEntry);
  const [sessionDays, setSessionDays] = useState(-1);
  useEffect(() => {
    setSessionDays(recordSessionDay() || getSessionDays());
  }, []);
  const SOFT_AUTH_SESSION_DAYS_THRESHOLD = 3;
  const [softAuthDismissed, setSoftAuthDismissed] = useState(() =>
    isSoftAuthDismissed(),
  );
  const entryCount = useMemo(() => countRealEntries(localStorageStore), []);
  const showSoftAuth =
    !user &&
    !softAuthDismissed &&
    typeof onShowAuth === "function" &&
    (hasRealEntry || sessionDays >= SOFT_AUTH_SESSION_DAYS_THRESHOLD);

  const [reengagement, setReengagement] = useState(() =>
    shouldShowReengagement(localStorageStore),
  );
  useEffect(() => {
    recordLastActiveDate(localStorageStore);
  }, []);

  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const activeNudge = useMemo(() => {
    if (nudgeDismissed || sessionDays < 2) return null;
    return getActiveNudge(localStorageStore, sessionDays, {
      picks: getVibePicks(),
    });
  }, [sessionDays, nudgeDismissed]);

  const { focus, rest, dismiss } = useDashboardFocus();

  const {
    insight: coachInsightText,
    loading: coachLoading,
    error: coachError,
    refresh: coachRefresh,
  } = useCoachInsight();

  const modulesWithSignal = useMemo(() => {
    const all = focus ? [focus, ...rest] : rest;
    const set = new Set<string>();
    for (const r of all) {
      if (r.module && r.module !== "hub") set.add(r.module);
    }
    return set;
  }, [focus, rest]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const quickAddByModule = useMemo(() => {
    const map: Record<string, { label: string; run: () => void } | undefined> =
      {};
    for (const id of modulesWithSignal) {
      const quick = getModulePrimaryAction(id);
      if (!quick) continue;
      map[id] = {
        label: quick.label,
        run: () =>
          openHubModuleWithAction(
            id as Parameters<typeof openHubModuleWithAction>[0],
            quick.action,
          ),
      };
    }
    return map;
  }, [modulesWithSignal]);

  const handleDragEnd = useCallback(
    (event: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        setOrder((prev) => {
          const activeId = String(active.id) as ModuleId;
          const overId = String(over.id) as ModuleId;
          const oldIndex = prev.indexOf(activeId);
          const newIndex = prev.indexOf(overId);
          const next = arrayMove(prev, oldIndex, newIndex);
          saveOrder(next);
          return next;
        });
      }
    },
    [],
  );

  const [digestExpanded, setDigestExpanded] = useState(false);
  const digestFresh = hasLiveWeeklyDigest();
  const now = new Date();
  const isMondayOrTuesday = now.getDay() === 1 || now.getDay() === 2;
  const showDigestFooter = digestFresh || isMondayOrTuesday;

  // ONE-HERO RULE
  let hero: React.ReactNode;
  if (firstActionVisible) {
    hero = (
      <FirstActionHeroCard onDismiss={() => setFirstActionVisible(false)} />
    );
  } else if (showSoftAuth) {
    hero = (
      <SoftAuthPromptCard
        onOpenAuth={onShowAuth}
        onDismiss={() => setSoftAuthDismissed(true)}
        entryCount={entryCount}
      />
    );
  } else {
    hero = (
      <TodayFocusCard
        focus={focus}
        onAction={onOpenModule}
        onDismiss={dismiss}
      />
    );
  }

  // Stagger index counter
  let si = 0;

  return (
    <div className="space-y-4">
      {reengagement.show && (
        <StaggerChild index={si++}>
          <ReEngagementCard
            daysInactive={reengagement.daysInactive}
            onContinue={() => setReengagement({ show: false, daysInactive: 0 })}
            onDismiss={() => setReengagement({ show: false, daysInactive: 0 })}
          />
        </StaggerChild>
      )}

      {/* Streak indicator */}
      <StaggerChild index={si++}>
        <StreakIndicator />
      </StaggerChild>

      {/* Hero card */}
      <StaggerChild index={si++}>{hero}</StaggerChild>

      {/* "Твій день" summary strip */}
      <StaggerChild index={si++}>
        <TodaySummaryStrip onOpenModule={onOpenModule} />
      </StaggerChild>

      {/* Assistant advice — hide error state */}
      <StaggerChild index={si++}>
        <AssistantAdviceCard
          insight={coachInsightText}
          loading={coachLoading}
          error={coachError}
          onRefresh={coachRefresh}
        />
      </StaggerChild>

      {activeNudge && !reengagement.show && (
        <StaggerChild index={si++}>
          <DailyNudge
            nudge={activeNudge}
            sessionDays={sessionDays}
            onDismiss={() => setNudgeDismissed(true)}
          />
        </StaggerChild>
      )}

      {/* MODULE CARDS — 2×2 bento grid */}
      <StaggerChild index={si++}>
        <section className="space-y-2">
          <SectionHeading as="h2" size="xs" className="px-0.5">
            Модулі
          </SectionHeading>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3">
                {order.map((id) => (
                  <SortableCard
                    key={id}
                    id={id as ModuleId}
                    onOpenModule={onOpenModule}
                    quickAdd={quickAddByModule[id] || null}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </StaggerChild>

      {/* Secondary content */}
      <StaggerChild index={si++}>
        <div className="space-y-2">
          <HubInsightsPanel
            items={rest}
            onOpenModule={onOpenModule}
            onDismiss={dismiss}
          />

          {digestExpanded ? (
            <WeeklyDigestCard />
          ) : showDigestFooter ? (
            <WeeklyDigestFooter
              fresh={digestFresh}
              onExpand={() => setDigestExpanded(true)}
            />
          ) : null}
        </div>
      </StaggerChild>

      {/* Motivational footer */}
      <MotivationalFooter />
    </div>
  );
}
