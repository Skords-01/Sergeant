/**
 * HeroPromiseCard — cold-start outcome promise that replaces
 * `<OnboardingProgress />` for users without `first_real_entry` (PR-09,
 * master tracker §5).
 *
 * The pre-PR-09 cold-start scaffold framed activation as a TODO list
 * («2/4 розділів готові») which reads as obsoleteness to a goal-less
 * user. This card flips the framing to outcome-first: per-primary-module
 * headline + body + CTA that routes directly into the module's first-
 * action sheet via the canonical `openHubModuleWithAction` event.
 *
 * Surface contract:
 *   • Only renders when the `dashboard_outcome_card_v1` flag is ON
 *     **and** the user has a `primaryModule` **and** no real entry
 *     has been recorded yet. All three guards are evaluated by
 *     `HubHeroBlock`; the component itself just renders.
 *   • Copy + CTA action come from `@sergeant/shared` (`HERO_PROMISE`)
 *     so the same lookup table can be re-used by mobile parity
 *     (PR-21) without re-shipping strings.
 *   • Analytics: fires `hero_promise_shown` once per mount and
 *     `hero_promise_cta` on click. PostHog can A/B these against the
 *     legacy `<OnboardingProgress />` fallback during the FF rollout.
 */
import { useCallback, useEffect } from "react";
import { Icon, type IconName } from "@shared/components/ui/Icon";
import { Button } from "@shared/components/ui/Button";
import {
  openHubModuleWithAction,
  type HubModuleAction,
} from "@shared/lib/modules/hubNav";
import {
  getHeroPromiseCopy,
  type DashboardModuleId,
  type HeroPromiseAction,
} from "@sergeant/shared";
import { trackEvent, ANALYTICS_EVENTS } from "../observability/analytics";

const MODULE_ACCENT: Record<
  DashboardModuleId,
  { surface: string; border: string; icon: string; iconBg: string }
> = {
  finyk: {
    surface: "bg-finyk-soft/50 dark:bg-finyk/8",
    border: "border-finyk/20",
    icon: "text-finyk-strong dark:text-finyk",
    iconBg: "bg-finyk/15",
  },
  fizruk: {
    surface: "bg-fizruk-soft/50 dark:bg-fizruk/8",
    border: "border-fizruk/20",
    icon: "text-fizruk-strong dark:text-fizruk",
    iconBg: "bg-fizruk/15",
  },
  routine: {
    surface: "bg-routine-surface/50 dark:bg-routine/8",
    border: "border-routine/20",
    icon: "text-routine-strong dark:text-routine",
    iconBg: "bg-routine/15",
  },
  nutrition: {
    surface: "bg-nutrition-soft/50 dark:bg-nutrition/8",
    border: "border-nutrition/20",
    icon: "text-nutrition-strong dark:text-nutrition",
    iconBg: "bg-nutrition/15",
  },
};

const MODULE_ICON: Record<DashboardModuleId, IconName> = {
  finyk: "wallet",
  fizruk: "dumbbell",
  routine: "calendar-check",
  nutrition: "utensils",
};

export interface HeroPromiseCardProps {
  /** Module that owns the promise — drives copy lookup + accent. */
  moduleId: DashboardModuleId;
  /**
   * Optional override for the CTA click handler. Default routes
   * through `openHubModuleWithAction` which is the canonical hub
   * navigation event consumed by every `HubModuleShell`.
   */
  onCta?: (moduleId: DashboardModuleId, action: HubModuleAction) => void;
}

// Pure mapping kept inline so the shared copy table doesn't have to
// know about web's `HubModuleAction` union.
function toHubAction(action: HeroPromiseAction): HubModuleAction {
  return action;
}

export function HeroPromiseCard({ moduleId, onCta }: HeroPromiseCardProps) {
  const copy = getHeroPromiseCopy(moduleId);
  const accent = MODULE_ACCENT[moduleId];

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.HERO_PROMISE_SHOWN, { module: moduleId });
  }, [moduleId]);

  const handleCta = useCallback(() => {
    if (!copy) return;
    const action = toHubAction(copy.ctaAction);
    trackEvent(ANALYTICS_EVENTS.HERO_PROMISE_CTA, {
      module: moduleId,
      action,
    });
    if (onCta) {
      onCta(moduleId, action);
      return;
    }
    openHubModuleWithAction(moduleId, action);
  }, [copy, moduleId, onCta]);

  if (!copy) return null;

  return (
    <section
      className={`relative rounded-2xl p-5 border ${accent.surface} ${accent.border} shadow-card`}
      aria-label={`Перший крок у модулі — ${copy.headline}`}
      data-testid="hero-promise-card"
      data-module={moduleId}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${accent.iconBg} ${accent.icon}`}
          aria-hidden="true"
        >
          <Icon name={MODULE_ICON[moduleId]} size={22} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h2 className="text-base font-bold text-text leading-tight">
            {copy.headline}
          </h2>
          <p className="text-sm text-muted leading-relaxed">{copy.body}</p>
          <div className="pt-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCta}
              data-testid="hero-promise-cta"
            >
              {copy.ctaLabel}
              <Icon name="chevron-right" size={14} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
