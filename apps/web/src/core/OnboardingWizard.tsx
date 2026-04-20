import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
import { trackEvent, ANALYTICS_EVENTS } from "./analytics";
import {
  ALL_MODULES,
  markFirstActionPending,
  markFirstActionStartedAt,
  saveVibePicks,
} from "./onboarding/vibePicks.js";
import { MODULE_LABELS } from "@shared/lib/moduleLabels";

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

// Module chips shown inline on the splash — the single source of truth
// for module taxonomy on this screen. Labels read from `MODULE_LABELS`
// so цей splash, hub-header і module bottom-nav усі показують одне й те
// ж бренд-ім'я («Фінік», а не «Гроші»). Раніше splash використовував
// аспіраційні слова («Гроші / Тіло / Їжа»), а потім модулі — бренд, і
// користувач не був певен що це одне й те ж. Бренд виграє, бо його й
// так видно на кожному внутрішньому екрані; аспіраційний опис живе в
// `teaser` ряду нижче.
//
// Keys match `ALL_MODULES` so picks feed straight into `saveVibePicks`.
const VIBE_CHIPS = [
  {
    id: "finyk",
    icon: "credit-card",
    label: MODULE_LABELS.finyk,
    teaser: "−320₴ / тиждень",
  },
  {
    id: "fizruk",
    icon: "dumbbell",
    label: MODULE_LABELS.fizruk,
    teaser: "5 трен. за 14 днів",
  },
  {
    id: "routine",
    icon: "check",
    label: MODULE_LABELS.routine,
    teaser: "стрік «вода» 7 днів",
  },
  {
    id: "nutrition",
    icon: "utensils",
    label: MODULE_LABELS.nutrition,
    teaser: "сніданок · 420 ккал",
  },
];

function VibeChipRow({ picks, togglePick }) {
  return (
    <div className="w-full space-y-2">
      <p className="text-[11px] text-muted text-center">
        Зніми зайве — решту легко додати потім.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {VIBE_CHIPS.map((chip) => {
          const active = picks.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => togglePick(chip.id)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
                active
                  ? "border-brand-500/60 bg-brand-500/10 text-text shadow-card"
                  : "border-line bg-panel text-muted hover:border-brand-500/40",
              )}
            >
              <span
                className={cn(
                  "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  active ? "bg-brand-500/15 text-brand-600" : "bg-panelHi",
                )}
                aria-hidden
              >
                <Icon name={chip.icon} size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text leading-tight truncate">
                  {chip.label}
                </span>
                <span className="block text-[11px] text-muted leading-tight truncate">
                  {chip.teaser}
                </span>
              </span>
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
  // Zero-picks used to disable the CTA. That gate punished users who deselected
  // every chip to see what happens — `finish()` already falls back to
  // ALL_MODULES, so we let the tap through and surface a gentle hint instead.
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
          Гроші, тіло, звички, їжа. Офлайн. ~5 секунд на перший запис.
        </p>
      </div>
      <VibeChipRow picks={picks} togglePick={togglePick} />
      <div className="w-full space-y-2">
        <Button
          type="button"
          onClick={onContinue}
          variant="primary"
          size="lg"
          className="w-full"
        >
          Заповни мій хаб
          <Icon name="chevron-right" size={16} />
        </Button>
        {!hasPicks && (
          <p className="text-[11px] text-muted">
            Без вибору — всі 4 модулі. Налаштуєш потім.
          </p>
        )}
      </div>
      <p className="text-[11px] text-subtle leading-relaxed">
        Усе локально. Синхрон — коли сам захочеш.
      </p>
    </div>
  );
}

/**
 * Onboarding splash. Renders the same single-step content either as a
 * modal overlay (default, for legacy callers) or inline inside a larger
 * layout when a parent already owns the page chrome.
 *
 * The `fullPage` variant is used by the `/welcome` route so the splash
 * becomes a URL-addressable cold-start surface with the populated hub
 * peeking through behind it, instead of a dialog that hovers over an
 * empty page.
 *
 * @param {object} props
 * @param {(startModuleId: string | null, opts?: { intent: string, picks: string[] }) => void} props.onDone
 * @param {"modal" | "fullPage"} [props.variant="modal"]
 */
export function OnboardingWizard({ onDone, variant = "modal" }) {
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
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_VIBE_PICKED, {
      picks: chosen,
      picksCount: chosen.length,
    });
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      intent: "vibe_empty",
      picksCount: chosen.length,
    });
    markFirstActionStartedAt();
    markFirstActionPending();
    markOnboardingDone();
    // Stay on the hub dashboard — the FirstActionHeroCard appears on top
    // of the empty module rows a tick later via the
    // `first_action_pending` flag and walks the user to their first real
    // entry (no more fake demo numbers on fresh accounts).
    onDone(null, { intent: "vibe_empty", picks: chosen });
  };

  const content = (
    <SplashStep picks={picks} togglePick={togglePick} onContinue={finish} />
  );

  if (variant === "fullPage") {
    // Parent (`WelcomeScreen`) owns the full-page frame + peek backdrop.
    // We render just the card so the splash can share the same viewport
    // with a blurred hub preview without a modal dialog wrapper.
    return (
      <div
        className="relative w-full max-w-sm bg-panel border border-line rounded-3xl shadow-float p-6 space-y-5 animate-onboarding-enter"
        aria-label="Вітальний екран"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4 pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label="Вітальний екран"
    >
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-3xl shadow-float p-6 space-y-5 animate-onboarding-enter">
        {content}
      </div>
    </div>
  );
}
