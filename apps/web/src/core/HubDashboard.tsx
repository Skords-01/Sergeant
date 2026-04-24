import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
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
import { SoftAuthPromptCard } from "./onboarding/SoftAuthPromptCard.jsx";
import { FirstActionHeroCard } from "./onboarding/FirstActionSheet.jsx";
import { detectFirstRealEntry } from "./onboarding/firstRealEntry.js";
import {
  isSoftAuthDismissed,
  isFirstActionPending,
  recordSessionDay,
  getSessionDays,
} from "./onboarding/vibePicks.js";
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

// Public labels for each module, surfaced in Settings → "Упорядкувати модулі".
// The source of truth lives in `@sergeant/shared` so the mobile dashboard
// and the web dashboard cannot drift out of sync on copy.
export const DASHBOARD_MODULE_LABELS = SHARED_DASHBOARD_MODULE_LABELS;

export function loadDashboardOrder() {
  return normalizeDashboardOrder(safeReadLS(DASHBOARD_ORDER_KEY, null));
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
interface ModuleConfig {
  icon: ReactNode;
  label: string;
  module: string;
  iconClass: string;
  accentClass: string;
  description: string;
  hasGoal: boolean;
  getPreview: () => ModulePreview;
}

type ModuleId = "finyk" | "fizruk" | "routine" | "nutrition";

const MODULE_CONFIGS: Record<ModuleId, ModuleConfig> = {
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
    iconClass: "bg-finyk-soft text-finyk dark:bg-finyk/15",
    accentClass: "bg-finyk",
    description: "Транзакції та бюджети",
    hasGoal: false,
    getPreview: () =>
      selectModulePreview(
        "finyk",
        safeReadStringLS(STORAGE_KEYS.FINYK_QUICK_STATS),
      ),
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
    iconClass: "bg-fizruk-soft text-fizruk dark:bg-fizruk/15",
    accentClass: "bg-fizruk",
    description: "Тренування та прогрес",
    hasGoal: false,
    getPreview: () =>
      selectModulePreview(
        "fizruk",
        safeReadStringLS(STORAGE_KEYS.FIZRUK_QUICK_STATS),
      ),
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
    iconClass: "bg-routine-surface text-routine dark:bg-routine/15",
    accentClass: "bg-routine",
    description: "Звички та щоденні цілі",
    hasGoal: true,
    getPreview: () =>
      selectModulePreview(
        "routine",
        safeReadStringLS(STORAGE_KEYS.ROUTINE_QUICK_STATS),
      ),
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
    iconClass: "bg-nutrition-soft text-nutrition dark:bg-nutrition/15",
    accentClass: "bg-nutrition",
    description: "КБЖВ та раціон",
    hasGoal: true,
    getPreview: () =>
      selectModulePreview(
        "nutrition",
        safeReadStringLS(STORAGE_KEYS.NUTRITION_QUICK_STATS),
      ),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STATUS ROW — «тихий» рядок модуля в секції «Статус»
// ═══════════════════════════════════════════════════════════════════════════
// Раніше це був ModuleRow із chevron-ом, завжди-видимим progress-баром і
// per-row Demo-піллю. Стало: без chevron-а (весь рядок клікабельний), без
// progress-бару (крім випадків коли модуль справді має ціль і прогрес), без
// «Демо» пілюлі (єдиний strip над секцією статус). Рядок, що відповідає
// модулю з активним сигналом (focus/rest), отримує inline-кнопку `+`, що
// dispatchає primary-дію без додаткового тапа «відкрити модуль».
// ═══════════════════════════════════════════════════════════════════════════
// Мемоізуємо рядок — перерендериться тільки якщо реально змінився його
// config/quickAdd/isDragging. Без memo кожна зміна state на дашборді
// (FTUX-герой, м'яка авторизація, digest-експанд) перераховувала всі
// чотири модульні рядки, включно з `preview = config.getPreview()`,
// що читає localStorage.
interface QuickAddDescriptor {
  label: string;
  run: () => void;
}

interface StatusRowProps {
  config: ModuleConfig;
  onClick: () => void;
  onQuickAdd?: QuickAddDescriptor | null;
  dragProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const StatusRow = memo(function StatusRow({
  config,
  onClick,
  onQuickAdd,
  dragProps,
  isDragging,
}: StatusRowProps) {
  const preview = config.getPreview();
  const showProgress =
    config.hasGoal && preview.progress !== undefined && preview.progress > 0;

  return (
    <div
      className={cn(
        "group relative flex items-center",
        "bg-panel hover:bg-panelHi transition-colors",
        isDragging && "opacity-70 shadow-float z-50 cursor-grabbing",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0 text-left",
          "transition-transform duration-150 active:scale-[0.99]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset",
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
                  "h-full rounded-full transition-[width,background-color] duration-700 ease-out",
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
          ) : preview.sub ? (
            <span className="text-xs text-muted truncate">{preview.sub}</span>
          ) : (
            <span className="text-xs text-subtle/80 truncate" aria-hidden>
              —
            </span>
          )}
        </div>
      </button>

      {onQuickAdd && (
        <button
          type="button"
          onClick={onQuickAdd.run}
          aria-label={onQuickAdd.label}
          title={onQuickAdd.label}
          className={cn(
            "shrink-0 mr-2 w-7 h-7 rounded-lg flex items-center justify-center",
            "text-text bg-panelHi hover:bg-primary hover:text-bg",
            "transition-colors",
          )}
        >
          <Icon name="plus" size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SORTABLE CARD WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
// `memo` + локальний `useCallback` для onClick — коли `onOpenModule` і
// `quickAdd` стабільні (див. `HubDashboard`), перерендер всього списку
// стає no-op для рядків, які не тягнуть у dnd-kit.
interface SortableCardProps {
  id: ModuleId;
  onOpenModule: (id: ModuleId) => void;
  quickAdd?: QuickAddDescriptor | null;
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
      <StatusRow
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
// MONDAY AUTO DIGEST HOOK
// ═══════════════════════════════════════════════════════════════════════════
// Opt-in: users must explicitly enable this in Hub → Settings → AI Звіт тижня.
// Default is OFF so a cold-start Monday visit never spends an AI call the
// user didn't ask for. Toggle is persisted in localStorage.
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
// WEEKLY DIGEST FOOTER — тихий лінк у нижньому ряду. Fresh-dot показується,
// коли live-digest за цей тиждень існує.
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

  // Inline FTUX hero — replaces the old post-wizard `FirstActionSheet`
  // modal. Reads the localStorage flag once; dismiss clears the flag.
  const [firstActionVisible, setFirstActionVisible] = useState(() =>
    isFirstActionPending(),
  );

  // Soft auth prompt — an "offer to save", never a toll gate. Two triggers:
  //   1. user has entered real data (the moment the local data becomes
  //      worth losing), or
  //   2. user has been opening the hub for N+ distinct days without ever
  //      creating an account — catches the browse-only cohort that would
  //      otherwise silently lose everything on a device swap. N is small
  //      enough that a regular user hits it within their first week.
  const hasRealEntry = detectFirstRealEntry();
  useFirstEntryCelebration(hasRealEntry);
  // Record today's session on mount so the proactive nudge actually
  // accumulates days. Using state + effect instead of a ref guard in the
  // render body — the ref pattern caused a localStorage write during the
  // render phase, which React Strict Mode can double-invoke.
  const [sessionDays, setSessionDays] = useState(-1);
  useEffect(() => {
    setSessionDays(recordSessionDay() || getSessionDays());
  }, []);
  const SOFT_AUTH_SESSION_DAYS_THRESHOLD = 3;
  const [softAuthDismissed, setSoftAuthDismissed] = useState(() =>
    isSoftAuthDismissed(),
  );
  const showSoftAuth =
    !user &&
    !softAuthDismissed &&
    typeof onShowAuth === "function" &&
    (hasRealEntry || sessionDays >= SOFT_AUTH_SESSION_DAYS_THRESHOLD);

  const { focus, rest, dismiss } = useDashboardFocus();

  // Coach insight підʼєднується на рівні дашборду і передається в NextCard
  // як inline italic-рядок. Раніше він жив у `HubInsightsPanel` і
  // змушував секцію авто-розкриватись — зараз інсайт стоїть поруч із
  // фокусом, без окремого місця у списку.
  const { insight: coachInsightText } = useCoachInsight();

  // ─────────────────────────────────────────────────────────────────────
  // «Є сигнал?» мапа — які модулі мають видиму рекомендацію. Використовується
  // для inline-`+` у StatusRow. focus+rest охоплює всі recs, які не були
  // dismissed.
  // ─────────────────────────────────────────────────────────────────────
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

  // Стабільна мапа quickAdd-дій по модулю — раніше обчислювалась inline у
  // `.map()` і створювала новий об'єкт з новою closure `run` кожного рендеру,
  // що пробивало `memo(SortableCard)`. Тепер набір перераховується лише
  // коли реально змінюється набір модулів з сигналом.
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

  // Weekly digest: не показуємо картку автоматично. Fresh-дот у footer
  // появляється, якщо користувач явно згенерував digest цього тижня. Сам
  // card розкривається тільки по тапу на footer-link.
  const [digestExpanded, setDigestExpanded] = useState(false);
  const digestFresh = hasLiveWeeklyDigest();
  // Footer-лінк видно тільки коли є свіжий digest АБО сьогодні Пн/Вт
  // (коли має сенс нагадати про підсумок тижня). Інакше лінк ховається,
  // щоб не створювати постійного шуму.
  const now = new Date();
  const isMondayOrTuesday = now.getDay() === 1 || now.getDay() === 2;
  const showDigestFooter = digestFresh || isMondayOrTuesday;

  // ─────────────────────────────────────────────────────────────────────
  // ONE-HERO RULE. На екрані завжди рівно одна primary-картка:
  //   FirstAction → SoftAuth → NextCard
  // FTUX-онбординг-картки мають власні CTA, тому їх не треба дублювати з
  // NextCard. Як тільки вони зняті, хероєм стає NextCard (focus чи empty).
  // ─────────────────────────────────────────────────────────────────────
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
      />
    );
  } else {
    hero = (
      <TodayFocusCard
        focus={focus}
        onAction={onOpenModule}
        onDismiss={dismiss}
        coachInsight={coachInsightText}
      />
    );
  }

  return (
    <div className="space-y-4">
      {hero}

      {/* STATUS — тихий список модулів. Рядок, під який підʼїхала
          рекомендація, отримує inline `+` для quick-add. */}
      <section className="space-y-2">
        <SectionHeading as="h2" size="xs" className="px-0.5">
          Статус
        </SectionHeading>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="rounded-2xl border border-line bg-panel overflow-hidden divide-y divide-line/60">
              {order.map((id) => (
                <SortableCard
                  key={id}
                  id={id}
                  onOpenModule={onOpenModule}
                  quickAdd={quickAddByModule[id] || null}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* «ще» — тихий футер-ряд з вторинними точками входу. HubInsightsPanel
          ховає rest за колапсом; WeeklyDigest-link показується лише в Пн/Вт
          або коли є свіжий звіт, щоб не створювати постійного шуму. */}
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
    </div>
  );
}
