import { useEffect, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { openHubModuleWithAction, openHubModule } from "@shared/lib/hubNav";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import { clearFirstActionPending, getVibePicks } from "./vibePicks.js";

/**
 * Per-module "one tap to your first real entry" cards. Each option routes
 * into its module with a PWA action (the same handler PWA shortcuts use),
 * so a single tap lands the user on an already-open input.
 *
 * Routine is an exception: it doesn't have a dedicated PWA action, so we
 * just open the module. The module lands on the habit list where a demo
 * habit is ready to tap.
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
    title: "Відмітити звичку",
    desc: "Почни стрік сьогодні",
    accent: "text-routine bg-routine-soft",
    run: () => openHubModule("routine"),
  },
};

export function FirstActionSheet({ onClose }) {
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
    onClose?.();
  };

  const pick = (id) => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_FIRST_ACTION_PICKED, {
      module: id,
    });
    // Close the sheet first so the module opens without a stacked dialog.
    clearFirstActionPending();
    onClose?.();
    const action = ACTIONS[id];
    if (action) action.run();
  };

  return (
    <div
      className="fixed inset-0 z-[450] flex items-end sm:items-center justify-center p-4 pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label="Перша дія"
    >
      <button
        type="button"
        aria-label="Закрити"
        onClick={dismiss}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-3xl shadow-float p-6 space-y-4 animate-onboarding-enter">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-text">
              Одна дія — і хаб твій.
            </h2>
            <p className="text-sm text-muted mt-1 leading-snug">
              Цифри нижче — приклад. Твої з&apos;являться, щойно щось додаси.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-muted hover:text-text p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            aria-label="Закрити"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {picks
            .filter((id) => ACTIONS[id])
            .map((id) => {
              const a = ACTIONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pick(id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-2xl border border-line bg-panelHi",
                    "hover:border-brand-500/50 hover:bg-brand-500/5 transition-all",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center",
                        a.accent,
                      )}
                    >
                      <Icon name={a.icon} size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-text">
                        {a.title}
                      </div>
                      <div className="text-xs text-muted mt-0.5 truncate">
                        {a.desc}
                      </div>
                    </div>
                    <Icon
                      name="chevron-right"
                      size={16}
                      className="text-muted"
                    />
                  </div>
                </button>
              );
            })}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-full text-sm text-muted hover:text-text px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        >
          Пізніше — хочу спочатку подивитися
        </button>
      </div>
    </div>
  );
}
