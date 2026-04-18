import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { trackEvent, ANALYTICS_EVENTS } from "./analytics";

export const ONBOARDING_DONE_KEY = "hub_onboarding_done_v1";

function hasExistingData() {
  try {
    const finyk = localStorage.getItem("finyk_tx_cache");
    if (finyk) return true;
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
          Ваш особистий простір для фінансів, тренувань, звичок та харчування.
          Давайте налаштуємо все під вас.
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
        Починаємо →
      </button>
    </div>
  );
}

function FizrukStep({ goal, setGoal, onNext, onBack }) {
  const goals = [
    {
      id: "strength",
      label: "💪 Набір сили",
      desc: "Важкі ваги, мала кількість повторень",
    },
    {
      id: "endurance",
      label: "🏃 Витривалість",
      desc: "Кардіо, тривалі тренування",
    },
    {
      id: "weight_loss",
      label: "🔥 Схуднення",
      desc: "Кардіо + силові, дефіцит калорій",
    },
    {
      id: "flexibility",
      label: "🧘 Гнучкість",
      desc: "Розтяжка, йога, мобільність",
    },
    {
      id: "general",
      label: "🎯 Загальна форма",
      desc: "Збалансовані тренування для здоров'я",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl mb-2">🏋️</div>
        <h2 className="text-xl font-bold text-text">Ціль тренувань</h2>
        <p className="text-sm text-muted mt-1">
          Що хочете досягти у фізичній формі?
        </p>
      </div>
      <div className="space-y-2">
        {goals.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGoal(g.id)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-2xl border transition-all",
              goal === g.id
                ? "border-accent bg-accent/10"
                : "border-line bg-panelHi hover:border-muted",
            )}
          >
            <div className="text-sm font-semibold text-text">{g.label}</div>
            <div className="text-xs text-muted mt-0.5">{g.desc}</div>
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
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 rounded-2xl bg-accent text-forest font-bold text-sm hover:brightness-110 transition"
        >
          Далі →
        </button>
      </div>
    </div>
  );
}

function NutritionStep({ kcal, setKcal, onNext, onBack }) {
  const presets = [
    { id: 1500, label: "1500 ккал", desc: "Схуднення" },
    { id: 2000, label: "2000 ккал", desc: "Підтримка форми" },
    { id: 2500, label: "2500 ккал", desc: "Набір маси" },
    { id: 3000, label: "3000 ккал", desc: "Активне зростання" },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl mb-2">🥗</div>
        <h2 className="text-xl font-bold text-text">Ціль з калорій</h2>
        <p className="text-sm text-muted mt-1">
          Скільки калорій на день ви плануєте?
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setKcal(p.id)}
            className={cn(
              "px-4 py-3 rounded-2xl border transition-all text-center",
              kcal === p.id
                ? "border-accent bg-accent/10"
                : "border-line bg-panelHi hover:border-muted",
            )}
          >
            <div className="text-sm font-semibold text-text">{p.label}</div>
            <div className="text-xs text-muted mt-0.5">{p.desc}</div>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="onboarding-kcal-custom"
          className="text-xs font-semibold text-muted uppercase tracking-wider"
        >
          Або вкажіть своє значення
        </label>
        <input
          id="onboarding-kcal-custom"
          type="number"
          min={800}
          max={6000}
          value={kcal || ""}
          onChange={(e) => setKcal(Number(e.target.value) || 0)}
          placeholder="ккал / день"
          className="w-full bg-panelHi border border-line rounded-2xl px-4 py-3 text-sm text-text placeholder:text-subtle outline-none focus:border-accent/50 transition-colors"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-2xl border border-line text-sm text-muted hover:text-text hover:bg-panelHi transition"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 rounded-2xl bg-accent text-forest font-bold text-sm hover:brightness-110 transition"
        >
          Далі →
        </button>
      </div>
    </div>
  );
}

function FinanceStep({ startModule, setStartModule, onDone, onBack }) {
  const modules = [
    { id: "finyk", label: "💳 Фінік", desc: "Почати з фінансів і транзакцій" },
    { id: "fizruk", label: "🏋️ Фізрук", desc: "Почати з тренувань" },
    { id: "routine", label: "✅ Рутина", desc: "Почати з звичок і календаря" },
    {
      id: "nutrition",
      label: "🥗 Харчування",
      desc: "Почати з відстеження їжі",
    },
    { id: null, label: "🏠 Головна", desc: "Залишитися на дашборді" },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl mb-2">🚀</div>
        <h2 className="text-xl font-bold text-text">З чого почнемо?</h2>
        <p className="text-sm text-muted mt-1">
          Оберіть перший модуль, який хочете відкрити
        </p>
      </div>
      <div className="space-y-2">
        {modules.map((m) => (
          <button
            key={String(m.id)}
            type="button"
            onClick={() => setStartModule(m.id)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-2xl border transition-all",
              startModule === m.id
                ? "border-accent bg-accent/10"
                : "border-line bg-panelHi hover:border-muted",
            )}
          >
            <div className="text-sm font-semibold text-text">{m.label}</div>
            <div className="text-xs text-muted mt-0.5">{m.desc}</div>
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
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-3 rounded-2xl bg-accent text-forest font-bold text-sm hover:brightness-110 transition"
        >
          Почати! 🎉
        </button>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("general");
  const [kcal, setKcal] = useState(2000);
  const [startModule, setStartModule] = useState(null);

  const TOTAL = 4;

  // Wizard mounts exactly once per onboarding attempt — emit start event here
  // rather than in a parent so the signal is colocated with the flow itself.
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const handleDone = () => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      startModule: startModule || "none",
      providedName: Boolean(name.trim()),
    });
    if (name.trim()) {
      try {
        localStorage.setItem("hub_user_name", name.trim());
      } catch {}
    }
    if (goal) {
      try {
        localStorage.setItem("fizruk_onboarding_goal", goal);
      } catch {}
    }
    if (kcal > 0) {
      try {
        const prefs = JSON.parse(
          localStorage.getItem("nutrition_prefs_v1") || "{}",
        );
        prefs.dailyTargetKcal = kcal;
        localStorage.setItem("nutrition_prefs_v1", JSON.stringify(prefs));
      } catch {}
    }
    markOnboardingDone();
    onDone(startModule);
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
              markOnboardingDone();
              onDone(null);
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
          <FizrukStep
            goal={goal}
            setGoal={setGoal}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <NutritionStep
            kcal={kcal}
            setKcal={setKcal}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <FinanceStep
            startModule={startModule}
            setStartModule={setStartModule}
            onDone={handleDone}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
