import { useEffect, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { openHubModuleWithAction } from "@shared/lib/hubNav";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import { clearFirstActionPending, getVibePicks } from "./vibePicks.js";

/**
 * Per-module "one tap to your first real entry" tiles. Each option routes
 * into its module with a PWA action (the same handler PWA shortcuts use),
 * so a single tap lands the user on an already-open input.
 */
const ACTIONS = {
  finyk: {
    icon: "credit-card",
    title: "Додай витрату",
    desc: "5 секунд, будь-яка сума",
    accent: "text-finyk bg-finyk-soft",
    run: () => openHubModuleWithAction("finyk", "add_expense"),
  },
  fizruk: {
    icon: "dumbbell",
    title: "Увімкни розминку",
    desc: "10 хв, таймер сам",
    accent: "text-fizruk bg-fizruk-soft",
    run: () => openHubModuleWithAction("fizruk", "start_workout"),
  },
  nutrition: {
    icon: "utensils",
    title: "Сфоткай обід",
    desc: "Калорії порахую я",
    accent: "text-nutrition bg-nutrition-soft",
    run: () => openHubModuleWithAction("nutrition", "add_meal"),
  },
  routine: {
    icon: "check",
    title: "Створити звичку",
    desc: "Почни стрік сьогодні",
    accent: "text-routine bg-routine-soft",
    run: () => openHubModuleWithAction("routine", "add_habit"),
  },
};

/**
 * Inline FTUX hero card rendered on the Hub dashboard when a first action
 * is pending. Replaces the old blocking `FirstActionSheet` modal so the
 * user sees their populated hub plus the quick-win CTAs in the same view
 * (no dialog to dismiss before touching their data).
 */
export function FirstActionHeroCard({ onDismiss }) {
  const picks = useMemo(() => {
    const raw = getVibePicks();
    return raw.length > 0 ? raw : Object.keys(ACTIONS);
  }, []);

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_FIRST_ACTION_SHOWN, {
      picks,
    });
  }, [picks]);

  const dismiss = () => {
    clearFirstActionPending();
    onDismiss?.();
  };

  const pick = (id) => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_FIRST_ACTION_PICKED, {
      module: id,
    });
    clearFirstActionPending();
    onDismiss?.();
    const action = ACTIONS[id];
    if (action) action.run();
  };

  const visible = picks.filter((id) => ACTIONS[id]);
  if (visible.length === 0) return null;

  return (
    <section
      className="relative bg-panel border border-line rounded-2xl p-4 shadow-card space-y-3"
      aria-label="Перша дія"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Старт
          </div>
          <h2 className="text-base font-bold text-text mt-0.5">
            Одна дія — і хаб твій
          </h2>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            Цифри нижче — приклад. Твої з&apos;являться, щойно щось додаси.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 -mt-1 -mr-1 text-muted hover:text-text p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
          aria-label="Сховати"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {visible.map((id) => {
          const a = ACTIONS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl border border-line bg-panelHi",
                "hover:border-brand-500/50 hover:bg-brand-500/5 transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 shrink-0 rounded-xl flex items-center justify-center",
                    a.accent,
                  )}
                >
                  <Icon name={a.icon} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">
                    {a.title}
                  </div>
                  <div className="text-xs text-muted mt-0.5 truncate">
                    {a.desc}
                  </div>
                </div>
                <Icon name="chevron-right" size={16} className="text-muted" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
