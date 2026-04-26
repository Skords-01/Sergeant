import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";

// Static preview of the populated hub that sits behind the splash card on
// `/welcome`. Renders a 2×2 bento grid matching `HubDashboard`'s module
// cards so the blurred silhouette under the splash accurately teases the
// real dashboard layout new users are about to see.
const PEEK_CARDS = [
  {
    id: "finyk",
    label: "💰 Фінік",
    cardBg: "bg-finyk-soft/40 dark:bg-finyk-surface-dark/8",
    iconClass: "bg-finyk-soft text-finyk dark:bg-finyk-surface-dark/15",
    icon: "credit-card",
    metric: "−320 ₴",
    sub: "тиждень",
  },
  {
    id: "fizruk",
    label: "💪 Фізрук",
    cardBg: "bg-fizruk-soft/40 dark:bg-fizruk-surface-dark/8",
    iconClass: "bg-fizruk-soft text-fizruk dark:bg-fizruk-surface-dark/15",
    icon: "dumbbell",
    metric: "5 трен.",
    sub: "14 днів",
  },
  {
    id: "routine",
    label: "✅ Рутина",
    cardBg: "bg-routine-surface/40 dark:bg-routine-surface-dark/8",
    iconClass:
      "bg-routine-surface text-routine dark:bg-routine-surface-dark/15",
    icon: "check",
    metric: "7 днів",
    sub: "стрік",
  },
  {
    id: "nutrition",
    label: "🥗 Харчування",
    cardBg: "bg-nutrition-soft/40 dark:bg-nutrition-surface-dark/8",
    iconClass:
      "bg-nutrition-soft text-nutrition dark:bg-nutrition-surface-dark/15",
    icon: "utensils",
    metric: "420 ккал",
    sub: "сніданок",
  },
];

function PeekBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className={cn(
          "absolute inset-0",
          // Soft brand wash so the backdrop never looks empty on cold load.
          "bg-gradient-to-b from-brand-500/5 via-transparent to-transparent",
        )}
      />
      {/* Faux hub rendered under a blur so the user perceives the shape
          and accent colors of their about-to-be-populated dashboard, but
          can't read individual numbers well enough to be distracted from
          the splash copy. Uses a 2×2 bento grid matching the real dashboard. */}
      <div
        className="absolute inset-x-0 top-0 pt-[max(2.5rem,env(safe-area-inset-top))] px-5 max-w-lg mx-auto w-full opacity-40 blur-[6px]"
        style={{ filter: "blur(6px) saturate(0.85)" }}
      >
        <div className="space-y-3">
          <div>
            <div className="h-6 w-32 rounded-md bg-panelHi" />
            <div className="h-3 w-24 rounded-md bg-panelHi mt-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PEEK_CARDS.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "flex flex-col rounded-3xl border border-line p-3.5 shadow-card",
                  card.cardBg,
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-2",
                    card.iconClass,
                  )}
                >
                  <Icon
                    name={card.icon}
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
                <span className="text-xs font-semibold text-text">
                  {card.label}
                </span>
                <span className="text-lg font-bold text-text tabular-nums mt-1">
                  {card.metric}
                </span>
                <span className="text-2xs text-muted mt-0.5">{card.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page cold-start at `/welcome`. Owns the page chrome + peek
 * backdrop and delegates the splash card to `OnboardingWizard` in
 * `fullPage` mode.
 *
 * @param {object} props
 * @param {(startModuleId: string | null, opts?: { intent: string, picks: string[] }) => void} props.onDone
 * @param {() => void} props.onOpenAuth - Navigate to the sign-in route for
 *   users who already have an account.
 */
export function WelcomeScreen({ onDone, onOpenAuth }) {
  return (
    <div className="relative min-h-dvh bg-bg text-text overflow-hidden page-enter">
      <PeekBackdrop />
      <div className="relative min-h-dvh flex items-end sm:items-center justify-center p-4 pb-safe">
        <div className="w-full max-w-sm space-y-3">
          <OnboardingWizard onDone={onDone} variant="fullPage" />
          {/* Returning-user entry. The previous text-xs muted underline was
              almost invisible on a fresh device — users who already had an
              account were dropped into onboarding. Promoted to a secondary
              button so the "у мене є акаунт" path is visible without
              competing with the primary splash CTA. */}
          <button
            type="button"
            onClick={onOpenAuth}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "h-11 min-h-[44px] rounded-2xl border border-line bg-panel/60",
              "text-sm font-semibold text-text",
              "hover:bg-panelHi hover:border-brand-500/40 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
            )}
          >
            <Icon name="user" size={16} strokeWidth={2} aria-hidden />
            <span>У мене вже є акаунт</span>
          </button>
        </div>
      </div>
    </div>
  );
}
