import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
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
import {
  markOnboardingDone,
  shouldShowOnboarding as sharedShouldShowOnboarding,
} from "./onboarding/onboardingGate.js";
import { MODULE_LABELS } from "@shared/lib/moduleLabels";
import {
  ONBOARDING_MODULE_DESCRIPTIONS,
  ONBOARDING_STEPS,
  ONBOARDING_VIBE_ICONS,
  ONBOARDING_VIBE_TEASERS,
  type OnboardingStepId,
} from "@sergeant/shared";
import {
  EMPTY_GOALS,
  getGoalQuestions,
  saveOnboardingGoals,
  type GoalQuestion,
  type OnboardingGoals,
} from "@sergeant/shared";

// Re-exported so `App.tsx` and any legacy call-site keep importing
// `shouldShowOnboarding` straight from this file.
export function shouldShowOnboarding() {
  return sharedShouldShowOnboarding();
}

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

interface WizardState {
  step: OnboardingStepId;
  picks: string[];
  goals: OnboardingGoals;
  stepStartedAt: number;
}

type WizardAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "TOGGLE_PICK"; id: string }
  | { type: "SET_GOAL"; key: keyof OnboardingGoals; value: unknown };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "NEXT": {
      const idx = ONBOARDING_STEPS.indexOf(state.step);
      if (idx < ONBOARDING_STEPS.length - 1) {
        return {
          ...state,
          step: ONBOARDING_STEPS[idx + 1],
          stepStartedAt: Date.now(),
        };
      }
      return state;
    }
    case "BACK": {
      const idx = ONBOARDING_STEPS.indexOf(state.step);
      if (idx > 0) {
        return {
          ...state,
          step: ONBOARDING_STEPS[idx - 1],
          stepStartedAt: Date.now(),
        };
      }
      return state;
    }
    case "TOGGLE_PICK": {
      const picks = state.picks.includes(action.id)
        ? state.picks.filter((p) => p !== action.id)
        : [...state.picks, action.id];
      return { ...state, picks };
    }
    case "SET_GOAL":
      return {
        ...state,
        goals: { ...state.goals, [action.key]: action.value },
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Step indicator (3 dots)
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-6 h-1.5 bg-brand-500"
              : "w-1.5 h-1.5 bg-muted/30",
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
        <Icon name="sparkle" size={40} strokeWidth={1.8} aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text">Привіт. Це Sergeant.</h2>
        <p className="text-sm text-muted leading-relaxed max-w-xs mx-auto">
          Гроші, тіло, звички, їжа — все в одному місці. Офлайн. Приватно. Через
          хвилину побачиш свій хаб.
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Icon name="wifi-off" size={14} aria-hidden />
          Офлайн
        </span>
        <span className="flex items-center gap-1">
          <Icon name="lock" size={14} aria-hidden />
          Локально
        </span>
        <span className="flex items-center gap-1">
          <Icon name="zap" size={14} aria-hidden />
          ~30 сек
        </span>
      </div>
      <Button
        type="button"
        onClick={onContinue}
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

// ---------------------------------------------------------------------------
// Step 2: Module selection (ModuleCards)
// ---------------------------------------------------------------------------

const MODULE_CARDS = ALL_MODULES.map((id) => ({
  id,
  icon: ONBOARDING_VIBE_ICONS[id],
  label: MODULE_LABELS[id],
  teaser: ONBOARDING_VIBE_TEASERS[id],
  description: ONBOARDING_MODULE_DESCRIPTIONS[id],
}));

function ModuleCard({
  card,
  active,
  onToggle,
}: {
  card: (typeof MODULE_CARDS)[number];
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "relative w-full text-left p-3.5 rounded-2xl border transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
        active
          ? "border-brand-500/60 bg-brand-500/8 shadow-card"
          : "border-line bg-panel hover:border-brand-500/30",
      )}
    >
      {active && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center">
          <Icon name="check" size={12} strokeWidth={3} />
        </span>
      )}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
            active
              ? "bg-brand-500/15 text-brand-600 dark:text-brand-400"
              : "bg-panelHi text-muted",
          )}
          aria-hidden
        >
          <Icon name={card.icon} size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pr-4">
          <span className="block text-sm font-bold text-text leading-tight">
            {card.label}
          </span>
          <span className="block text-xs text-muted mt-0.5 leading-snug">
            {card.description}
          </span>
          <span className="block text-[11px] text-subtle mt-1 leading-tight">
            {card.teaser}
          </span>
        </div>
      </div>
    </button>
  );
}

function ModulesStep({
  picks,
  togglePick,
  onContinue,
  onBack,
}: {
  picks: string[];
  togglePick: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text">Що тобі важливо?</h2>
        <p className="text-xs text-muted">
          Обери модулі — решту легко додати потім.
        </p>
      </div>
      <div className="w-full space-y-2">
        {MODULE_CARDS.map((card, idx) => (
          <div
            key={card.id}
            className="animate-module-card"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <ModuleCard
              card={card}
              active={picks.includes(card.id)}
              onToggle={() => togglePick(card.id)}
            />
          </div>
        ))}
      </div>
      <div className="w-full flex gap-2">
        <Button
          type="button"
          onClick={onBack}
          variant="ghost"
          size="lg"
          className="w-auto px-4"
        >
          <Icon name="chevron-left" size={16} />
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          variant="primary"
          size="lg"
          className="flex-1"
        >
          Далі
          <Icon name="chevron-right" size={16} />
        </Button>
      </div>
      {picks.length === 0 && (
        <p className="text-[11px] text-muted">Без вибору — всі 4 модулі.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Goal-setting
// ---------------------------------------------------------------------------

function GoalRadioGroup({
  question,
  value,
  onChange,
}: {
  question: GoalQuestion;
  value: string | null;
  onChange: (v: string) => void;
}) {
  if (!question.options) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-text text-left">
        {question.title}
      </p>
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
              value === opt.value
                ? "border-brand-500/60 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                : "border-line bg-panel text-text hover:border-brand-500/30",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GoalSlider({
  question,
  value,
  onChange,
}: {
  question: GoalQuestion;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const s = question.slider;
  if (!s) return null;
  const current = value ?? Math.round((s.min + s.max) / 2);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-text text-left">
          {question.title}
        </p>
        <span className="text-sm font-bold text-brand-600 dark:text-brand-400 tabular-nums">
          {current.toLocaleString("uk-UA")}
          {s.unit}
        </span>
      </div>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
      <div className="flex justify-between text-[11px] text-muted">
        <span>
          {s.min.toLocaleString("uk-UA")}
          {s.unit}
        </span>
        <span>
          {s.max.toLocaleString("uk-UA")}
          {s.unit}
        </span>
      </div>
    </div>
  );
}

/** Map question id → OnboardingGoals key. */
const GOAL_KEY_MAP: Record<string, keyof OnboardingGoals> = {
  finyk_budget: "finykBudget",
  fizruk_weekly: "fizrukWeeklyGoal",
  routine_first_habit: "routineFirstHabit",
  nutrition_goal: "nutritionGoal",
};

function GoalsStep({
  picks,
  goals,
  onSetGoal,
  onFinish,
  onBack,
}: {
  picks: string[];
  goals: OnboardingGoals;
  onSetGoal: (key: keyof OnboardingGoals, value: unknown) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const questions = useMemo(() => getGoalQuestions(picks as never[]), [picks]);
  const hasQuestions = questions.length > 0;

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text">
          {hasQuestions ? "Твої цілі" : "Готово!"}
        </h2>
        <p className="text-xs text-muted">
          {hasQuestions
            ? "Необов'язково — можна пропустити."
            : "Налаштуй деталі потім у кожному модулі."}
        </p>
      </div>

      {hasQuestions && (
        <div className="w-full space-y-4 text-left">
          {questions.map((q) => {
            const goalKey = GOAL_KEY_MAP[q.id];
            if (q.type === "radio") {
              return (
                <GoalRadioGroup
                  key={q.id}
                  question={q}
                  value={(goals[goalKey] as string | null) ?? null}
                  onChange={(v) => {
                    onSetGoal(goalKey, v);
                    trackEvent(ANALYTICS_EVENTS.ONBOARDING_GOAL_SET, {
                      module: q.module,
                      goalType: q.id,
                      value: v,
                    });
                  }}
                />
              );
            }
            return (
              <GoalSlider
                key={q.id}
                question={q}
                value={(goals[goalKey] as number | null) ?? null}
                onChange={(v) => {
                  onSetGoal(goalKey, v);
                  trackEvent(ANALYTICS_EVENTS.ONBOARDING_GOAL_SET, {
                    module: q.module,
                    goalType: q.id,
                    value: v,
                  });
                }}
              />
            );
          })}
        </div>
      )}

      <div className="w-full flex gap-2">
        <Button
          type="button"
          onClick={onBack}
          variant="ghost"
          size="lg"
          className="w-auto px-4"
        >
          <Icon name="chevron-left" size={16} />
        </Button>
        <Button
          type="button"
          onClick={onFinish}
          variant="primary"
          size="lg"
          className="flex-1"
        >
          Заповни мій хаб
          <Icon name="chevron-right" size={16} />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

/**
 * Multi-step onboarding wizard (v2).
 *
 * 3 steps: Welcome → Module selection → Goal-setting → Hub.
 *
 * Renders as a modal overlay (default) or inline card (`fullPage`
 * variant) inside the `/welcome` route.
 */
export function OnboardingWizard({
  onDone,
  variant = "modal",
}: {
  onDone: (
    startModuleId: string | null,
    opts?: { intent: string; picks: string[] },
  ) => void;
  variant?: "modal" | "fullPage";
}) {
  const [state, dispatch] = useReducer(wizardReducer, {
    step: "welcome",
    picks: [...ALL_MODULES],
    goals: { ...EMPTY_GOALS },
    stepStartedAt: Date.now(),
  });

  // Track wizard start
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED);
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, { step: "welcome" });
  }, []);

  // Track step views
  const trackStepTransition = useCallback(
    (fromStep: OnboardingStepId, toStep: OnboardingStepId) => {
      const duration = Date.now() - state.stepStartedAt;
      trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, {
        step: fromStep,
        durationMs: duration,
      });
      trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, { step: toStep });
    },
    [state.stepStartedAt],
  );

  const handleNext = useCallback(() => {
    const idx = ONBOARDING_STEPS.indexOf(state.step);
    if (idx < ONBOARDING_STEPS.length - 1) {
      trackStepTransition(state.step, ONBOARDING_STEPS[idx + 1]);
    }
    dispatch({ type: "NEXT" });
  }, [state.step, trackStepTransition]);

  const handleBack = useCallback(() => {
    dispatch({ type: "BACK" });
  }, []);

  const togglePick = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_PICK", id });
  }, []);

  const setGoal = useCallback((key: keyof OnboardingGoals, value: unknown) => {
    dispatch({ type: "SET_GOAL", key, value });
  }, []);

  const finish = useCallback(() => {
    const chosen = state.picks.length > 0 ? state.picks : [...ALL_MODULES];
    saveVibePicks(chosen as never[]);

    // Persist goals
    saveOnboardingGoals(
      {
        getString: (k) => {
          try {
            return localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setString: (k, v) => {
          try {
            localStorage.setItem(k, v);
          } catch {
            /* noop */
          }
        },
        remove: (k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* noop */
          }
        },
      },
      {
        ...state.goals,
        fizrukWeeklyGoal: state.goals.fizrukWeeklyGoal
          ? Number(state.goals.fizrukWeeklyGoal)
          : null,
      },
    );

    // Track completion
    const duration = Date.now() - state.stepStartedAt;
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, {
      step: "goals",
      durationMs: duration,
    });
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_VIBE_PICKED, {
      picks: chosen,
      picksCount: chosen.length,
    });
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      intent: "vibe_empty",
      picksCount: chosen.length,
      hasGoals: Object.values(state.goals).some((v) => v !== null),
    });

    markFirstActionStartedAt();
    markFirstActionPending();
    markOnboardingDone();
    onDone(null, { intent: "vibe_empty", picks: chosen });
  }, [state.picks, state.goals, state.stepStartedAt, onDone]);

  const stepIdx = ONBOARDING_STEPS.indexOf(state.step);

  // Track transition direction for animation
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const stepKeyRef = useRef(0);

  const animatedNext = useCallback(() => {
    setDirection("forward");
    stepKeyRef.current += 1;
    handleNext();
  }, [handleNext]);

  const animatedBack = useCallback(() => {
    setDirection("backward");
    stepKeyRef.current += 1;
    handleBack();
  }, [handleBack]);

  const animatedFinish = useCallback(() => {
    setDirection("forward");
    finish();
  }, [finish]);

  const transitionClass =
    direction === "forward" ? "animate-step-forward" : "animate-step-backward";

  const content = (
    <div className="space-y-4">
      <StepIndicator current={stepIdx} total={ONBOARDING_STEPS.length} />
      <div key={stepKeyRef.current} className={transitionClass}>
        {state.step === "welcome" && <WelcomeStep onContinue={animatedNext} />}
        {state.step === "modules" && (
          <ModulesStep
            picks={state.picks}
            togglePick={togglePick}
            onContinue={animatedNext}
            onBack={animatedBack}
          />
        )}
        {state.step === "goals" && (
          <GoalsStep
            picks={state.picks}
            goals={state.goals}
            onSetGoal={setGoal}
            onFinish={animatedFinish}
            onBack={animatedBack}
          />
        )}
      </div>
    </div>
  );

  if (variant === "fullPage") {
    return (
      <div
        className="relative w-full max-w-sm bg-panel border border-line rounded-3xl shadow-float p-6 animate-onboarding-enter"
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
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-3xl shadow-float p-6 animate-onboarding-enter">
        {content}
      </div>
    </div>
  );
}
