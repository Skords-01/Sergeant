import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";
import { OnboardingWizard } from "../OnboardingWizard.jsx";

// Static preview of the populated hub that sits behind the splash card on
// `/welcome`. We intentionally don't render the real `HubDashboard` here
// — the module rows show numbers that haven't been seeded yet, so a real
// render would display zero-state copy and break the "look, this is your
// hub about to happen" illusion. Instead we hand-roll four rows matching
// `ModuleRow`'s visual rhythm.
const PEEK_ROWS = [
  {
    id: "finyk",
    label: "Фінік",
    accent: "text-finyk-strong dark:text-finyk bg-finyk-soft",
    icon: "credit-card",
    metric: "−320 грн",
    sub: "тиждень",
  },
  {
    id: "fizruk",
    label: "Фізрук",
    accent: "text-fizruk-strong dark:text-fizruk bg-fizruk-soft",
    icon: "dumbbell",
    metric: "5 трен.",
    sub: "14 днів",
  },
  {
    id: "routine",
    label: "Рутина",
    accent: "text-routine-strong dark:text-routine bg-routine-surface",
    icon: "check",
    metric: "7 днів",
    sub: "стрік «вода»",
  },
  {
    id: "nutrition",
    label: "Харчування",
    accent: "text-nutrition-strong dark:text-nutrition bg-nutrition-soft",
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
          the splash copy. */}
      <div
        className="absolute inset-x-0 top-0 pt-[max(2.5rem,env(safe-area-inset-top))] px-5 max-w-lg mx-auto w-full opacity-40 blur-[6px]"
        style={{ filter: "blur(6px) saturate(0.85)" }}
      >
        <div className="space-y-3">
          <div>
            <div className="h-6 w-32 rounded-md bg-panelHi" />
            <div className="h-3 w-24 rounded-md bg-panelHi mt-2" />
          </div>
          <div className="rounded-2xl border border-line bg-panel overflow-hidden divide-y divide-line/60">
            {PEEK_ROWS.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 px-4 py-3 bg-panel"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    row.accent,
                  )}
                >
                  <Icon name={row.icon} size={16} strokeWidth={2} aria-hidden />
                </div>
                <span className="text-xs font-semibold text-text truncate">
                  {row.label}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm font-semibold text-text tabular-nums">
                    {row.metric}
                  </span>
                  <span className="text-[11px] text-muted">{row.sub}</span>
                </div>
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
