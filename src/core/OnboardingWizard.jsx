import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { trackEvent, ANALYTICS_EVENTS } from "./analytics";

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
  } catch {}
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
  } catch {}
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
              ? "w-5 h-2 bg-accent"
              : i < current
                ? "w-2 h-2 bg-accent/40"
                : "w-2 h-2 bg-line",
          )}
        />
      ))}
    </div>
  );
}

function WelcomeStep({ name, setName, onNext }) {
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center text-4xl">
        👋
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text">Вітаємо в Hub!</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Почнемо з головного — грошей. Це займе менше хвилини.
        </p>
      </div>
      <div className="w-full space-y-1.5 text-left">
        <label
          htmlFor="onboarding-display-name"
          className="text-xs font-semibold text-muted uppercase tracking-wider"
        >
          Як вас звати?
        </label>
        <input
          id="onboarding-display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={"Ваше ім'я (необов'язково)"}
          className="w-full bg-panelHi border border-line rounded-2xl px-4 py-3 text-sm text-text placeholder:text-subtle outline-none focus:border-accent/50 transition-colors"
        />
      </div>
      <button
        type="button"
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl bg-accent text-forest font-bold text-sm hover:brightness-110 transition"
      >
        Далі →
      </button>
    </div>
  );
}

// The three "first value" paths a new user can pick. Keep copy short: every
// extra word is a decision the user has to make before they see any value.
function QuickStartStep({ onPick, onBack }) {
  const options = [
    {
      id: "bank",
      icon: "💳",
      title: "Підключити Monobank",
      desc: "Автоматичні транзакції за 30 секунд",
    },
    {
      id: "manual",
      icon: "✍️",
      title: "Додати першу витрату",
      desc: "Швидко, без входу в банк",
    },
    {
      id: "demo",
      icon: "🎮",
      title: "Спробувати з демо",
      desc: "Пара тижнів прикладів — щоб побачити, як це виглядає",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl mb-2">🚀</div>
        <h2 className="text-xl font-bold text-text">Швидкий старт</h2>
        <p className="text-sm text-muted mt-1">
          Оберіть, з чого почнемо у Фініку
        </p>
      </div>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="w-full text-left px-4 py-3 rounded-2xl border border-line bg-panelHi hover:border-accent/50 hover:bg-accent/5 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-accent/10 flex items-center justify-center text-xl">
                {o.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">{o.title}</div>
                <div className="text-xs text-muted mt-0.5 truncate">
                  {o.desc}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-2xl border border-line text-sm text-muted hover:text-text hover:bg-panelHi transition"
        >
          Назад
        </button>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");

  const TOTAL = 2;

  // Wizard mounts exactly once per onboarding attempt — emit start event here
  // rather than in a parent so the signal is colocated with the flow itself.
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const finish = (intent) => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      intent,
      providedName: Boolean(name.trim()),
    });
    if (name.trim()) {
      try {
        localStorage.setItem("hub_user_name", name.trim());
      } catch {}
    }
    markOnboardingDone();
    // Every quick-start path currently lands in Finyk — banks, manual
    // entry and demo data all live there. Keeping the module id explicit
    // makes it trivial to branch later (e.g. "спробувати фізрук з демо").
    onDone("finyk", { intent });
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
              // "Пропустити" — still fire a completion event so funnels can
              // distinguish skipped vs explicit quick-start picks.
              trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
                intent: "skipped",
                providedName: Boolean(name.trim()),
              });
              markOnboardingDone();
              onDone(null, { intent: "skipped" });
            }}
            className="text-xs text-muted hover:text-text transition-colors"
          >
            Пропустити
          </button>
        </div>

        {step === 0 && (
          <WelcomeStep
            name={name}
            setName={setName}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <QuickStartStep
            onPick={(intent) => finish(intent)}
            onBack={() => setStep(0)}
          />
        )}
      </div>
    </div>
  );
}
