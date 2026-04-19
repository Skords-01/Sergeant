import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
import { trackEvent, ANALYTICS_EVENTS } from "./analytics";
import {
  ALL_MODULES,
  markFirstActionPending,
  saveVibePicks,
} from "./onboarding/vibePicks.js";
import { seedDemoForModules } from "./onboarding/demoSeeds.js";

const ONBOARDING_DONE_KEY = "hub_onboarding_done_v1";

function hasExistingData() {
  try {
    const finyk = localStorage.getItem("finyk_tx_cache");
    if (finyk) return true;
    const manual = localStorage.getItem("finyk_manual_expenses_v1");
    if (manual) {
      const p = JSON.parse(manual);
      if (Array.isArray(p) && p.length > 0) return true;
    }
    const fizruk = localStorage.getItem("fizruk_workouts_v1");
    if (fizruk) {
      const p = JSON.parse(fizruk);
      const arr = Array.isArray(p) ? p : p?.workouts;
      if (Array.isArray(arr) && arr.length > 0) return true;
    }
    const nutrition = localStorage.getItem("nutrition_log_v1");
    if (nutrition) {
      const p = JSON.parse(nutrition);
      if (p && Object.keys(p).length > 0) return true;
    }
    const routine = localStorage.getItem("hub_routine_v1");
    if (routine) {
      const p = JSON.parse(routine);
      if (Array.isArray(p?.habits) && p.habits.length > 0) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function shouldShowOnboarding() {
  try {
    if (localStorage.getItem(ONBOARDING_DONE_KEY)) return false;
    if (hasExistingData()) {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1");
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

// Static preview of what a "full" Sergeant hub looks like: four concrete
// metrics rendered at once in a compact 2×2 grid. Replaces the earlier
// auto-cycling ticker — a full rotation took ~9 s, which burnt a third of
// the 30-second FTUX promise before the user could even tap the CTA.
const SPLASH_PREVIEW_ITEMS = [
  {
    icon: "credit-card",
    accent: "text-finyk bg-finyk-soft",
    metric: "−320 грн",
    label: "на каву цього тижня",
  },
  {
    icon: "dumbbell",
    accent: "text-fizruk bg-fizruk-soft",
    metric: "5 трен.",
    label: "за 14 днів",
  },
  {
    icon: "check",
    accent: "text-routine bg-routine-soft",
    metric: "7 днів",
    label: "стрік — «вода»",
  },
  {
    icon: "utensils",
    accent: "text-nutrition bg-nutrition-soft",
    metric: "420 ккал",
    label: "сніданок",
  },
];

function SplashPreviewGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {SPLASH_PREVIEW_ITEMS.map((item) => (
        <div
          key={item.icon}
          className={cn(
            "rounded-xl border border-line bg-surface",
            "px-3 py-2.5 flex items-center gap-2.5 text-left",
          )}
        >
          <div
            className={cn(
              "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              item.accent,
            )}
          >
            <Icon name={item.icon} size={18} strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text leading-tight truncate">
              {item.metric}
            </div>
            <div className="text-[11px] text-muted leading-tight truncate">
              {item.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Short per-module chips shown inline on the splash. Keys match
// `ALL_MODULES` so picks feed straight into `saveVibePicks`.
const VIBE_CHIPS = [
  { id: "finyk", icon: "credit-card", label: "Гроші" },
  { id: "fizruk", icon: "dumbbell", label: "Тіло" },
  { id: "routine", icon: "check", label: "Рутина" },
  { id: "nutrition", icon: "utensils", label: "Їжа" },
];

function VibeChipRow({ picks, togglePick }) {
  return (
    <div className="w-full space-y-2">
      <p className="text-[11px] text-muted text-center">
        Тапни, щоб виключити, що зараз не актуально.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {VIBE_CHIPS.map((chip) => {
          const active = picks.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => togglePick(chip.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
                active
                  ? "border-brand-500/60 bg-brand-500/10 text-text"
                  : "border-line bg-panelHi text-muted hover:border-brand-500/40",
              )}
            >
              <Icon name={chip.icon} size={14} strokeWidth={2} aria-hidden />
              <span className="text-xs font-medium">{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Single-step splash. Value prop, static preview and the vibe picker live
// in the same view so the user spends one screen — not two — before they
// see their populated hub. CTA stays enabled only while at least one
// module is picked; all four default to active so the lazy path is
// "tap → done".
function SplashStep({ picks, togglePick, onContinue }) {
  const hasPicks = picks.length > 0;
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="w-20 h-20 rounded-3xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
        <Icon name="sparkle" size={40} strokeWidth={1.8} aria-hidden />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text">
          Твоє життя — один екран.
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Гроші, тіло, звички, їжа. Офлайн. 30 секунд до першого запису.
        </p>
      </div>
      <SplashPreviewGrid />
      <VibeChipRow picks={picks} togglePick={togglePick} />
      <div className="w-full space-y-2">
        <Button
          type="button"
          onClick={onContinue}
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!hasPicks}
        >
          Заповни мій хаб
          <Icon name="chevron-right" size={16} />
        </Button>
        {!hasPicks && (
          <p className="text-[11px] text-muted">Обери хоч один модуль.</p>
        )}
      </div>
      <p className="text-[11px] text-subtle leading-relaxed">
        Усе локально. Синхрон — коли сам захочеш.
      </p>
    </div>
  );
}

export function OnboardingWizard({ onDone }) {
  // Single-step flow: default to "all four modules active" so the lazy
  // path is one tap. The vibe picker is still a real choice — motivated
  // users can deselect what they don't want before tapping the primary
  // CTA. Previously the default was `[]`, which forced every user through
  // an explicit-selection gate and added ~6 s to the time-to-value.
  const [picks, setPicks] = useState(() => [...ALL_MODULES]);

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const togglePick = (id) => {
    setPicks((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const finish = () => {
    const chosen = picks.length > 0 ? picks : [...ALL_MODULES];
    saveVibePicks(chosen);
    const seededCounts = seedDemoForModules(chosen);
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_VIBE_PICKED, {
      picks: chosen,
      picksCount: chosen.length,
    });
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_DEMO_RENDERED, {
      seededCounts,
    });
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      intent: "vibe_demo",
      picksCount: chosen.length,
    });
    markFirstActionPending();
    markOnboardingDone();
    // Stay on the hub dashboard so the user's "aha" is the whole populated
    // hub, not a single module. The FirstActionHeroCard appears on top of
    // the dashboard a tick later via the `first_action_pending` flag.
    onDone(null, { intent: "vibe_demo", picks: chosen });
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4 pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label="Вітальний екран"
    >
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-3xl shadow-float p-6 space-y-5 animate-onboarding-enter">
        <SplashStep picks={picks} togglePick={togglePick} onContinue={finish} />
      </div>
    </div>
  );
}
