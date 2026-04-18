import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
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

function WelcomeStep({ name, setName, onNext }) {
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="w-20 h-20 rounded-3xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
        <Icon name="sparkle" size={40} strokeWidth={1.8} aria-hidden />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text">Вітаємо в Sergeant!</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Особистий хаб для фінансів, звичок, тренувань та харчування.
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
          className="w-full min-h-[44px] bg-panelHi border border-line rounded-2xl px-4 py-3 text-[16px] md:text-sm text-text placeholder:text-subtle outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/30 transition-colors"
        />
      </div>
      <Button
        type="button"
        onClick={onNext}
        variant="primary"
        size="lg"
        className="w-full"
      >
        Далі
        <Icon name="chevron-right" size={16} />
      </Button>
    </div>
  );
}

// Step 2: module picker. Shows all 4 modules so the user knows Sergeant is
// more than Finyk before being routed to a specific quick-start flow.
const MODULE_OPTIONS = [
  {
    id: "finyk",
    icon: "credit-card",
    title: "Фінік",
    desc: "Бюджет, витрати, банки",
    accent: "bg-finyk/10 text-finyk",
  },
  {
    id: "routine",
    icon: "check",
    title: "Рутина",
    desc: "Звички, трекер, серії",
    accent: "bg-routine/10 text-routine",
  },
  {
    id: "fizruk",
    icon: "dumbbell",
    title: "Фізрук",
    desc: "Тренування, кардіо, вага",
    accent: "bg-fizruk/10 text-fizruk",
  },
  {
    id: "nutrition",
    icon: "utensils",
    title: "Харчування",
    desc: "Журнал їжі, склад, рецепти",
    accent: "bg-nutrition/10 text-nutrition",
  },
];

function ModulePickerStep({ selected, setSelected, onNext, onBack }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center mb-2">
          <Icon name="target" size={28} strokeWidth={1.8} />
        </div>
        <h2 className="text-xl font-bold text-text">З чого почнемо?</h2>
        <p className="text-sm text-muted mt-1">
          Оберіть модуль — інші завжди під рукою на дашборді
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MODULE_OPTIONS.map((o) => {
          const isActive = selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o.id)}
              className={cn(
                "text-left px-3 py-3 rounded-2xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50",
                isActive
                  ? "border-brand-500 bg-brand-500/5"
                  : "border-line bg-panelHi hover:border-brand-500/40",
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center mb-1.5",
                  o.accent,
                )}
              >
                <Icon name={o.icon} size={18} />
              </div>
              <div className="text-sm font-semibold text-text">{o.title}</div>
              <div className="text-[11px] text-muted mt-0.5 leading-tight">
                {o.desc}
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
          className="flex-1"
          disabled={!selected}
        >
          Далі
          <Icon name="chevron-right" size={14} />
        </Button>
      </div>
    </div>
  );
}

// The three "first value" paths a new user can pick inside Фінік.
function FinykQuickStartStep({ onPick, onBack }) {
  const options = [
    {
      id: "manual",
      icon: "edit",
      title: "Додати першу витрату",
      desc: "Швидко, без входу в банк",
    },
    {
      id: "bank",
      icon: "credit-card",
      title: "Підключити Monobank",
      desc: "Автоматичні транзакції за 30 секунд",
    },
    {
      id: "demo",
      icon: "sparkle",
      title: "Спробувати з демо",
      desc: "Пара тижнів прикладів — щоб побачити, як це виглядає",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center mb-2">
          <Icon name="target" size={28} strokeWidth={1.8} />
        </div>
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
            className="w-full text-left px-4 py-3 rounded-2xl border border-line bg-panelHi hover:border-brand-500/50 hover:bg-brand-500/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
                <Icon name={o.icon} size={20} />
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
        <Button
          type="button"
          onClick={onBack}
          variant="secondary"
          size="md"
          className="flex-1"
        >
          Назад
        </Button>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [pickedModule, setPickedModule] = useState("finyk");

  // For Finyk we keep the 3-way quick-start; other modules get a single
  // "Відкрити" step so total step count flexes between 3 and 3.
  const TOTAL = 3;

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const persistName = () => {
    if (name.trim()) {
      try {
        localStorage.setItem("hub_user_name", name.trim());
      } catch {
        /* ignore */
      }
    }
  };

  const finishWithIntent = (intent) => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      intent,
      providedName: Boolean(name.trim()),
      module: pickedModule,
    });
    persistName();
    markOnboardingDone();
    onDone(pickedModule, { intent });
  };

  const finishSimple = () => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      intent: "open_module",
      providedName: Boolean(name.trim()),
      module: pickedModule,
    });
    persistName();
    markOnboardingDone();
    onDone(pickedModule, { intent: "open_module" });
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
              trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
                intent: "skipped",
                providedName: Boolean(name.trim()),
              });
              markOnboardingDone();
              onDone(null, { intent: "skipped" });
            }}
            className="text-xs text-muted hover:text-text transition-colors px-2 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
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
          <ModulePickerStep
            selected={pickedModule}
            setSelected={setPickedModule}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && pickedModule === "finyk" && (
          <FinykQuickStartStep
            onPick={finishWithIntent}
            onBack={() => setStep(1)}
          />
        )}
        {step === 2 && pickedModule !== "finyk" && (
          <ModuleOpenStep
            moduleId={pickedModule}
            onOpen={finishSimple}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}

function ModuleOpenStep({ moduleId, onOpen, onBack }) {
  const opt =
    MODULE_OPTIONS.find((o) => o.id === moduleId) || MODULE_OPTIONS[0];
  return (
    <div className="space-y-4 text-center">
      <div
        className={cn(
          "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center",
          opt.accent,
        )}
      >
        <Icon name={opt.icon} size={32} strokeWidth={1.8} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-text">{opt.title}</h2>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Готово. Натисніть «Відкрити», щоб почати. Решту модулів знайдете на
          дашборді.
        </p>
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
          onClick={onOpen}
          variant="primary"
          size="md"
          className="flex-1"
        >
          Відкрити
          <Icon name="chevron-right" size={14} />
        </Button>
      </div>
    </div>
  );
}
