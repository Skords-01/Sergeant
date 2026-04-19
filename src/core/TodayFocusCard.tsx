import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import {
  openHubModuleWithAction,
  type HubModuleAction,
  type HubModuleId,
} from "@shared/lib/hubNav";
import {
  MODULE_PRIMARY_ACTION,
  getModulePrimaryAction,
} from "@shared/lib/moduleQuickActions";
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

// Fallback for CTA коли rec не несе свого `pwaAction`: просто відкриває
// модуль. Імперативна дія (`add_expense`, `start_workout`, …) береться з
// `MODULE_PRIMARY_ACTION` і dispatchається через hubNav — центральний шлях
// квік-адду з дашборду.
const MODULE_OPEN_CTA = {
  finyk: "Відкрити Фінік",
  fizruk: "Відкрити Фізрук",
  routine: "Відкрити Рутину",
  nutrition: "Відкрити Харчування",
  hub: "Подивитись",
};

const MODULE_SHORT_LABEL: Record<HubModuleId, string> = {
  finyk: "Фінік",
  fizruk: "Фізрук",
  routine: "Рутина",
  nutrition: "Харчування",
};

function readJSON(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDismissed(map: Record<string, number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
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

  const dismiss = useCallback((id: string) => {
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

/**
 * Snapshot reward-сигналу для хедера Next: серія, що горить, або щойно
 * виконана ціль. Повертається маленьким chip'ом у хедері Next, замість
 * того щоб забирати окрему картку.
 */
function deriveRewardSignal(): {
  line: string;
  module: keyof typeof MODULE_ACCENT;
} | null {
  const routine = readJSON("routine_quick_stats") || {};
  const fizruk = readJSON("fizruk_quick_stats") || {};

  const streaks = [
    { module: "routine" as const, days: Number(routine.streak) || 0 },
    { module: "fizruk" as const, days: Number(fizruk.streak) || 0 },
  ]
    .filter((s) => s.days >= 2)
    .sort((a, b) => b.days - a.days);

  if (streaks.length > 0) {
    const top = streaks[0];
    return {
      line: `${top.days} днів поспіль`,
      module: top.module,
    };
  }
  return null;
}

interface QuickAddChip {
  module: HubModuleId;
  label: string;
  action: HubModuleAction;
}

const QUICK_ADD_CHIPS: QuickAddChip[] = (
  ["finyk", "nutrition", "routine", "fizruk"] as HubModuleId[]
).map((mod) => {
  const a = MODULE_PRIMARY_ACTION[mod];
  return { module: mod, label: a.shortLabel, action: a.action };
});

const MODULE_CHIP_CLASS: Record<HubModuleId, string> = {
  finyk: "bg-finyk-soft text-finyk",
  fizruk: "bg-fizruk-soft text-fizruk",
  routine: "bg-routine-surface text-routine",
  nutrition: "bg-nutrition-soft text-nutrition",
};

/**
 * Empty-state Next: коли жодної рекомендації немає. Замість пасивного
 * «Сьогодні нічого термінового» показує 4 quick-add чипи — один тап і
 * користувач фіксує запис, не мусячи шукати «+» FAB.
 */
function EmptyFocus() {
  const reward = deriveRewardSignal();
  const washClass = reward
    ? MODULE_WASH[reward.module]
    : "bg-panelHi/60 dark:bg-panelHi/30";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-panel p-4",
        washClass,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-2xs font-semibold uppercase tracking-widest text-muted">
          Зараз
        </span>
        {reward && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
              "text-2xs font-semibold text-text bg-panel/80 border border-line",
            )}
            title="Не розривай серію"
          >
            <span aria-hidden>🔥</span>
            {reward.line}
          </span>
        )}
      </div>

      <h2 className="text-base font-bold text-text leading-snug">
        Що зафіксуємо?
      </h2>
      <p className="text-xs text-muted mt-0.5 leading-relaxed">
        Один тап — один запис. Обери модуль і продовжуй.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_ADD_CHIPS.map((chip) => (
          <button
            key={chip.module}
            type="button"
            onClick={() => openHubModuleWithAction(chip.module, chip.action)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
              "text-xs font-semibold",
              "hover:brightness-110 active:scale-[0.98] transition-all",
              MODULE_CHIP_CLASS[chip.module],
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface FocusRec {
  id: string;
  module: keyof typeof MODULE_ACCENT;
  title: string;
  body?: string;
  icon?: string;
  action: string;
  pwaAction?: HubModuleAction;
}

/**
 * Primary hero on the dashboard: one next-best-action derived from the
 * recommendation engine, or an action-driven empty state when nothing is
 * pending. CTA виконує дію (PWA-intent) інлайн, а не навігує в модуль —
 * це ключова зміна action-driven дашборду.
 */
export function TodayFocusCard({
  focus,
  onAction,
  onDismiss,
  coachInsight,
}: {
  focus: FocusRec | null;
  onAction: (module: string) => void;
  onDismiss: (id: string) => void;
  coachInsight?: string | null;
}) {
  if (!focus) {
    return <EmptyFocus />;
  }

  const accent = MODULE_ACCENT[focus.module] || "bg-primary";
  const wash = MODULE_WASH[focus.module] || "bg-panelHi";

  const primary = focus.pwaAction
    ? (() => {
        const quick = getModulePrimaryAction(focus.module);
        return {
          label: quick?.label || MODULE_OPEN_CTA[focus.module] || "Відкрити",
          run: () =>
            openHubModuleWithAction(
              focus.module as HubModuleId,
              focus.pwaAction as HubModuleAction,
            ),
        };
      })()
    : {
        label: MODULE_OPEN_CTA[focus.module] || "Відкрити",
        run: () => onAction(focus.action),
      };

  // Fallback: коли primary був імперативним, додаємо текстовий линк
  // «Відкрити X» як secondary — для юзерів, які хочуть спершу
  // перевірити контекст у модулі, не фіксуючи нічого.
  const secondary =
    focus.pwaAction && onAction
      ? {
          label:
            `Відкрити ${MODULE_SHORT_LABEL[focus.module as HubModuleId] ?? ""}`.trim(),
          run: () => onAction(focus.action),
        }
      : null;

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
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-2xs font-semibold uppercase tracking-widest text-muted">
            Зараз
          </span>
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

        {coachInsight && (
          <p className="text-xs text-text/85 italic mt-2 leading-relaxed border-l-2 border-primary/40 pl-2">
            {coachInsight}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={primary.run}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "bg-primary text-bg text-xs font-semibold",
              "hover:brightness-110 active:scale-[0.98] transition-all",
            )}
          >
            {primary.label}
            <Icon name="chevron-right" size={14} strokeWidth={2.5} />
          </button>
          {secondary && (
            <button
              type="button"
              onClick={secondary.run}
              className={cn(
                "text-xs font-medium text-muted hover:text-text",
                "px-2.5 py-1.5 rounded-lg hover:bg-panelHi transition-colors",
              )}
            >
              {secondary.label}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(focus.id)}
              className={cn(
                "ml-auto text-xs font-medium text-muted hover:text-text",
                "px-2.5 py-1.5 rounded-lg hover:bg-panelHi transition-colors",
              )}
            >
              Пізніше
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
