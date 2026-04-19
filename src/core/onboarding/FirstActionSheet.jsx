import { useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { openHubModuleWithAction } from "@shared/lib/hubNav";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import { clearFirstActionPending, getVibePicks } from "./vibePicks.js";

/**
 * Per-module "one tap to your first real entry" definitions. Each action
 * routes into its module with a PWA action (the same handler PWA
 * shortcuts use), so a single tap lands the user on an already-open
 * input sheet.
 */
const ACTIONS = {
  routine: {
    icon: "check",
    title: "Створи першу звичку",
    desc: "30 секунд. Стрік почнеться сьогодні.",
    accent: "text-routine bg-routine-soft",
    run: () => openHubModuleWithAction("routine", "add_habit"),
  },
  finyk: {
    icon: "credit-card",
    title: "Додай першу витрату",
    desc: "5 секунд, будь-яка сума.",
    accent: "text-finyk bg-finyk-soft",
    run: () => openHubModuleWithAction("finyk", "add_expense"),
  },
  nutrition: {
    icon: "utensils",
    title: "Запиши перший прийом їжі",
    desc: "Калорії порахую я.",
    accent: "text-nutrition bg-nutrition-soft",
    run: () => openHubModuleWithAction("nutrition", "add_meal"),
  },
  fizruk: {
    icon: "dumbbell",
    title: "Увімкни розминку",
    desc: "10 хв, таймер сам.",
    accent: "text-fizruk bg-fizruk-soft",
    run: () => openHubModuleWithAction("fizruk", "start_workout"),
  },
};

// Priority order when more than one vibe is picked. Routine comes first
// because "create a habit" has the lowest friction (no numbers, no
// camera, no bank auth) and the highest emotional payoff (7-day streak
// preview). Fizruk requires an in-module wizard to produce a real entry,
// so it goes last.
const PRIORITY = ["routine", "finyk", "nutrition", "fizruk"];

function pickPrimary(picks) {
  for (const id of PRIORITY) {
    if (picks.includes(id)) return id;
  }
  return "routine";
}

/**
 * Inline FTUX row rendered at the top of the Hub dashboard when a first
 * action is pending. Replaces the earlier 4-tile `FirstActionHeroCard`
 * with one opinionated primary CTA plus an inline expand.
 *
 * Rationale: the old layout asked the user to *choose* a module before
 * they knew what any of them did, even though they had just selected
 * module chips on the splash one screen earlier. Forcing a second
 * explicit selection cost ~6 s and a visible beat of indecision. The
 * row now makes the default choice for them (highest-priority pick) and
 * only reveals the alternatives if they tap "Інший модуль".
 */
export function FirstActionHeroCard({ onDismiss }) {
  const picks = useMemo(() => {
    const raw = getVibePicks();
    return raw.length > 0 ? raw : Object.keys(ACTIONS);
  }, []);

  const primaryId = useMemo(() => pickPrimary(picks), [picks]);
  const primary = ACTIONS[primaryId];
  const others = useMemo(
    () => picks.filter((id) => id !== primaryId && ACTIONS[id]),
    [picks, primaryId],
  );

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_FIRST_ACTION_SHOWN, {
      picks,
      primary: primaryId,
    });
  }, [picks, primaryId]);

  const dismiss = () => {
    clearFirstActionPending();
    onDismiss?.();
  };

  const run = (id) => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_FIRST_ACTION_PICKED, {
      module: id,
      primary: primaryId,
      via: id === primaryId ? "primary" : "expand",
    });
    clearFirstActionPending();
    onDismiss?.();
    ACTIONS[id]?.run();
  };

  if (!primary) return null;

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
            Зроби одну річ — і хаб твій
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

      <button
        type="button"
        onClick={() => run(primaryId)}
        className={cn(
          "w-full text-left px-4 py-3 rounded-xl border-2 border-brand-500/50 bg-brand-500/5",
          "hover:border-brand-500 hover:bg-brand-500/10 transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center",
              primary.accent,
            )}
          >
            <Icon name={primary.icon} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-text">{primary.title}</div>
            <div className="text-xs text-muted mt-0.5 truncate">
              {primary.desc}
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-brand-600" />
        </div>
      </button>

      {others.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={cn(
              "w-full text-xs font-medium text-muted hover:text-text",
              "flex items-center justify-center gap-1 py-1",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 rounded-md",
            )}
          >
            <span>{expanded ? "Сховати" : "Інший модуль"}</span>
            <Icon
              name="chevron-right"
              size={12}
              className={cn(
                "transition-transform",
                expanded ? "rotate-90" : "rotate-0",
              )}
            />
          </button>

          {expanded && (
            <div className="space-y-2">
              {others.map((id) => {
                const a = ACTIONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => run(id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl border border-line bg-panelHi",
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
                      <Icon
                        name="chevron-right"
                        size={14}
                        className="text-muted"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
