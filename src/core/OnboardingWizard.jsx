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

export const ONBOARDING_DONE_KEY = "hub_onboarding_done_v1";

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

function StepDots({ total, current }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-5 h-2 bg-brand-500"
              : i < current
                ? "w-2 h-2 bg-brand-500/40"
                : "w-2 h-2 bg-line",
          )}
        />
      ))}
    </div>
  );
}

// A tiny auto-cycling preview of what a "full" Sergeant screen looks like:
// one metric per module, rotating on a 2.2s interval. Purely decorative —
// it exists so the user sees concrete numbers (not just words) in the first
// second of the splash, which is what sells the "life in one screen" pitch.
const SPLASH_TICKER_ITEMS = [
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
    label: "за останні 14 днів",
  },
  {
    icon: "check",
    accent: "text-routine bg-routine-soft",
    metric: "7 днів",
    label: "стрік — «випити воду»",
  },
  {
    icon: "utensils",
    accent: "text-nutrition bg-nutrition-soft",
    metric: "420 ккал",
    label: "сніданок сьогодні",
  },
];

function SplashTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % SPLASH_TICKER_ITEMS.length),
      2200,
    );
    return () => clearInterval(t);
  }, []);
  const item = SPLASH_TICKER_ITEMS[idx];
  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-line bg-surface",
        "px-4 py-3 flex items-center gap-3",
      )}
      aria-live="polite"
    >
      <div
        key={`icon-${idx}`}
        className={cn(
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          "animate-fade-in",
          item.accent,
        )}
      >
        <Icon name={item.icon} size={20} strokeWidth={2} aria-hidden />
      </div>
      <div key={`text-${idx}`} className="animate-fade-in text-left">
        <div className="text-base font-semibold text-text leading-tight">
          {item.metric}
        </div>
        <div className="text-xs text-muted leading-tight">{item.label}</div>
      </div>
      <div className="ml-auto flex items-center gap-1" aria-hidden>
        {SPLASH_TICKER_ITEMS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full transition-all",
              i === idx ? "w-1.5 h-1.5 bg-brand-500" : "w-1 h-1 bg-line",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Step 0 — Value prop. No name field, no form. The goal of this screen
// is to answer "what is this?" in one sentence and then get out of the way.
function SplashStep({ onNext }) {
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="w-20 h-20 rounded-3xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
        <Icon name="sparkle" size={40} strokeWidth={1.8} aria-hidden />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text">Життя в одному екрані.</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Гроші, тренування, звички та їжа — одне місце, одна статистика, один
          AI-помічник.
        </p>
      </div>
      <SplashTicker />
      <ul className="w-full space-y-2 text-left text-sm text-muted">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-600">•</span>
          <span>
            Без акаунту. Дані живуть на телефоні, поки сам не вирішиш
            синхронізувати.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-600">•</span>
          <span>Працює офлайн, встановлюється як додаток.</span>
        </li>
      </ul>
      <Button
        type="button"
        onClick={onNext}
        variant="primary"
        size="lg"
        className="w-full"
      >
        Спробувати за 30 секунд
        <Icon name="chevron-right" size={16} />
      </Button>
    </div>
  );
}

// Step 1 — Vibe picker. Multi-select across the 4 modules, preselected
// to "all" so the lazy user still gets a full dashboard, but motivated
// users can narrow to just what they came for.
const VIBE_OPTIONS = [
  {
    id: "finyk",
    icon: "credit-card",
    title: "Фінік",
    desc: "Куди зникають гроші",
    accent: "text-finyk bg-finyk-soft",
  },
  {
    id: "fizruk",
    icon: "dumbbell",
    title: "Фізрук",
    desc: "Тренування без хаосу",
    accent: "text-fizruk bg-fizruk-soft",
  },
  {
    id: "routine",
    icon: "check",
    title: "Рутина",
    desc: "Звички та стріки",
    accent: "text-routine bg-routine-soft",
  },
  {
    id: "nutrition",
    icon: "utensils",
    title: "Харчування",
    desc: "Фото → калорії",
    accent: "text-nutrition bg-nutrition-soft",
  },
];

function VibePickerStep({ picks, togglePick, onNext, onBack }) {
  const hasPicks = picks.length > 0;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center mb-2">
          <Icon name="target" size={28} strokeWidth={1.8} />
        </div>
        <h2 className="text-xl font-bold text-text">
          Що тобі зараз болить найбільше?
        </h2>
        <p className="text-sm text-muted mt-1">
          Обери одне або кілька — решту ввімкнеш потім.
        </p>
      </div>
      <div className="space-y-2">
        {VIBE_OPTIONS.map((o) => {
          const active = picks.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => togglePick(o.id)}
              aria-pressed={active}
              className={cn(
                "w-full text-left px-4 py-3 rounded-2xl border transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50",
                active
                  ? "border-brand-500/60 bg-brand-500/5 shadow-card"
                  : "border-line bg-panelHi hover:border-brand-500/40",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center",
                    o.accent,
                  )}
                >
                  <Icon name={o.icon} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">
                    {o.title}
                  </div>
                  <div className="text-xs text-muted mt-0.5 truncate">
                    {o.desc}
                  </div>
                </div>
                <div
                  className={cn(
                    "w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors",
                    active
                      ? "bg-brand-500 border-brand-500 text-white"
                      : "border-line",
                  )}
                  aria-hidden
                >
                  {active && <Icon name="check" size={14} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={onBack}
          variant="secondary"
          size="md"
          className="flex-1"
        >
          Назад
        </Button>
        <Button
          type="button"
          onClick={onNext}
          variant="primary"
          size="md"
          className="flex-[2]"
          disabled={!hasPicks}
        >
          Показати мій хаб
          <Icon name="chevron-right" size={16} />
        </Button>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState(() => [...ALL_MODULES]);

  const TOTAL = 2;

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
    // hub, not a single module. The FirstActionSheet will appear on top of
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
        <div className="flex items-center justify-between">
          <StepDots total={TOTAL} current={step} />
          <button
            type="button"
            onClick={() => {
              // Skip is an escape hatch for returning users who already know
              // the product. Name its cost honestly so casual skippers
              // understand why the hub is empty.
              trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
                intent: "skipped",
              });
              markOnboardingDone();
              onDone(null, { intent: "skipped" });
            }}
            className="text-xs text-muted hover:text-text transition-colors px-2 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            Пропустити до пустого хабу
          </button>
        </div>

        {step === 0 && <SplashStep onNext={() => setStep(1)} />}
        {step === 1 && (
          <VibePickerStep
            picks={picks}
            togglePick={togglePick}
            onNext={finish}
            onBack={() => setStep(0)}
          />
        )}
      </div>
    </div>
  );
}
