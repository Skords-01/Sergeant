import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { safeReadLS, safeWriteLS, safeRemoveLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { openHubModuleWithAction } from "@shared/lib/hubNav";
import { getModulePrimaryAction } from "@shared/lib/moduleQuickActions";
import { TodayFocusCard, useDashboardFocus } from "./TodayFocusCard.jsx";
import { HubInsightsPanel } from "./HubInsightsPanel.jsx";
import { WeeklyDigestCard, hasLiveWeeklyDigest } from "./WeeklyDigestCard.jsx";
import { useWeeklyDigest, loadDigest, getWeekKey } from "./useWeeklyDigest.js";
import { useCoachInsight } from "./useCoachInsight.js";
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
// STATUS ROW — «тихий» рядок модуля в секції «Статус»
// ═══════════════════════════════════════════════════════════════════════════
// Раніше це був ModuleRow із chevron-ом, завжди-видимим progress-баром і
// per-row Demo-піллю. Стало: без chevron-а (весь рядок клікабельний), без
// progress-бару (крім випадків коли модуль справді має ціль і прогрес), без
// «Демо» пілюлі (єдиний strip над секцією статус). Рядок, що відповідає
// модулю з активним сигналом (focus/rest), отримує inline-кнопку `+`, що
// dispatchає primary-дію без додаткового тапа «відкрити модуль».
// ═══════════════════════════════════════════════════════════════════════════
function StatusRow({ config, onClick, onQuickAdd, dragProps, isDragging }) {
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
}

// ═══════════════════════════════════════════════════════════════════════════
// SORTABLE CARD WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
function SortableCard({ id, onOpenModule, quickAdd }) {
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
      <StatusRow
        config={cfg}
        onClick={() => onOpenModule(id)}
        onQuickAdd={quickAdd}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

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
// DEMO STRIP — один тихий рядок над статус-списком, замість per-row «Демо»
// пілюль на кожному модулі. Не inline-dismissable, знімається автоматично
// після першого реального запису (див. `modulePreviewsAreDemo`).
// ═══════════════════════════════════════════════════════════════════════════
function DemoStrip() {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider",
        "text-brand-600 bg-brand-500/10 border border-brand-500/20 rounded-lg",
        "flex items-center justify-between gap-2",
      )}
      title="Це приклад — заміниться на твої дані після першого запису"
    >
      <span>Дані — приклад</span>
      <span className="font-normal normal-case tracking-normal text-muted">
        Заміниться після першого запису
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECONDARY CHIPS — ≤2 contextual quick-add chips, які підсвічуються тільки
// коли є сигнал (recs з pwaAction). Стоять між NextCard і списком статусу.
// Не дублює primary-CTA з NextCard — береться з `rest`, не з `focus`.
// ═══════════════════════════════════════════════════════════════════════════
function SecondaryChips({ chips }) {
  if (!chips || chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.run}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "text-xs font-medium text-text",
            "bg-panel border border-line hover:bg-panelHi transition-colors",
          )}
          title={chip.hint}
        >
          <span aria-hidden>{chip.icon}</span>
          {chip.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY DIGEST FOOTER — тихий лінк у нижньому ряду. Fresh-dot показується,
// коли live-digest за цей тиждень існує.
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

const MODULE_ICON_EMOJI = {
  finyk: "💳",
  fizruk: "🏋️",
  routine: "✅",
  nutrition: "🥗",
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HUB DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function HubDashboard({
  onOpenModule,
  onOpenChat: _onOpenChat,
  user,
  onShowAuth,
}) {
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

  // Фактичний «демо-mode» контексту залишається, поки немає жодного
  // реального запису. Раніше це малювало «Демо»-пілюлю на КОЖНОМУ рядку
  // статус-списку — тепер це один тихий strip над списком (див. DemoStrip).
  const modulePreviewsAreDemo = !hasRealEntry && wasDemoSeeded();

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

  // Secondary chips: до 2-х рекомендацій (без focus), які несуть pwaAction.
  // Показуються тільки коли у нас >1 recs (інакше focus вистачає). Кожен
  // chip відкриває модуль із інтентом, не просто навігуючи.
  const secondaryChips = useMemo(() => {
    const withAction = rest.filter((r) => r.pwaAction && r.module !== "hub");
    // де-дублюємо за модулем — один сигнал на модуль достатньо
    const seen = new Set<string>();
    const picked: typeof withAction = [];
    for (const r of withAction) {
      if (seen.has(r.module)) continue;
      seen.add(r.module);
      picked.push(r);
      if (picked.length >= 2) break;
    }
    return picked.map((r) => {
      const quick = getModulePrimaryAction(r.module);
      return {
        id: r.id,
        label: quick?.shortLabel || "Додати",
        hint: r.title,
        icon: MODULE_ICON_EMOJI[r.module] || "➕",
        run: () =>
          openHubModuleWithAction(
            r.module as Parameters<typeof openHubModuleWithAction>[0],
            r.pwaAction!,
          ),
      };
    });
  }, [rest]);

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
  //   FirstAction → DemoBanner → SoftAuth → NextCard
  // FTUX-онбординг-картки мають власні CTA, тому їх не треба дублювати з
  // NextCard. Як тільки вони зняті, хероєм стає NextCard (focus чи empty).
  // ─────────────────────────────────────────────────────────────────────
  let hero: React.ReactNode;
  if (firstActionVisible) {
    hero = (
      <FirstActionHeroCard onDismiss={() => setFirstActionVisible(false)} />
    );
  } else if (showDemoBanner) {
    hero = (
      <DemoModeBanner
        onDismiss={() => {
          dismissDemoBanner();
          setDemoBannerDismissed(true);
        }}
      />
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

      <SecondaryChips chips={secondaryChips} />

      {/* STATUS — тихий список модулів. Колапсована секція з одним демо-strip
          зверху (коли актуально). Рядок, під який підʼїхала рекомендація,
          отримує inline `+` для quick-add. */}
      <section className="space-y-2">
        <h2 className="px-0.5 text-xs font-semibold text-muted uppercase tracking-wider">
          Статус
        </h2>

        {modulePreviewsAreDemo && <DemoStrip />}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="rounded-2xl border border-line bg-panel overflow-hidden divide-y divide-line/60">
              {order.map((id) => {
                const hasSignal = modulesWithSignal.has(id);
                const quick = getModulePrimaryAction(id);
                const quickAdd =
                  hasSignal && quick
                    ? {
                        label: quick.label,
                        run: () =>
                          openHubModuleWithAction(
                            id as Parameters<typeof openHubModuleWithAction>[0],
                            quick.action,
                          ),
                      }
                    : null;
                return (
                  <SortableCard
                    key={id}
                    id={id}
                    onOpenModule={onOpenModule}
                    quickAdd={quickAdd}
                  />
                );
              })}
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
