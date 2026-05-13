import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banner } from "@shared/components/ui/Banner";
import { Button } from "@shared/components/ui/Button";
import { safeReadStringLS, safeWriteLS } from "@shared/lib/storage/storage";
import { usePlan } from "./usePlan";

/**
 * Trial-expiry banner (audit P1-9 — initiative 0010 Phase 4.2).
 *
 * Shown when the active subscription is in the Stripe `"trialing"` status
 * and the trial ends in ≤ 3 days. CTA navigates to `/pricing` so the user
 * can convert before the trial lapses. Dismissable per trial-period via a
 * `safeWriteLS` flag — re-arms automatically if a renewed subscription
 * exposes a new `currentPeriodEnd`.
 *
 * `currentPeriodEnd` is the canonical trial-end source. The server-side
 * billing serializer copies it from Stripe `Subscription.trial_end` while
 * the row is `trialing`; once the subscription transitions, the field
 * carries the next billing cycle so the banner naturally disappears.
 *
 * Storage key — `sergeant.billing.trialBannerDismissed.v1`. The value is
 * the ISO `currentPeriodEnd` the user dismissed; a different value (new
 * trial or shifted boundary) re-exposes the banner. Routes through
 * `safeWriteLS` / `safeReadStringLS` per Hard Rule #7 +
 * `sergeant-design/no-raw-local-storage` (allowlist budget: 0 raw uses).
 */

const STORAGE_KEY = "sergeant.billing.trialBannerDismissed.v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const SHOW_WITHIN_DAYS = 3;

// UA copy. Kept as module constants (referenced via JSX expression
// containers) so `sergeant-design/no-cyrillic-jsx-literal` stays clean
// without bloating the burndown allowlist — same pattern as PaywallModal
// (default prop values are also non-JSX string literals).
const TEXTS = {
  messageLead: "До завершення пробного періоду залишилось",
  ctaSubscribe: "Оформити підписку",
  ctaDismiss: "Не зараз",
  dismissAriaLabel: "Закрити банер пробного періоду",
  daySingular: "день",
  dayFew: "дні",
} as const;

function parseTrialEnd(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysRemaining(trialEndsAt: Date, now: Date): number {
  const diffMs = trialEndsAt.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / DAY_MS);
}

function formatDaysUa(n: number): string {
  // Trial banner only renders for n ∈ {1, 2, 3} (see SHOW_WITHIN_DAYS
  // + the `remainingDays > 0` guard). Ukrainian plural collapses cleanly
  // for that range — 1 → «день», 2..4 → «дні» — so we skip a general
  // pluralizer and inline the two forms we need.
  return n === 1 ? `1 ${TEXTS.daySingular}` : `${n} ${TEXTS.dayFew}`;
}

export interface TrialBannerProps {
  /**
   * Override "now" for deterministic tests / SSR snapshotting. Defaults
   * to a fresh `Date` per render — the banner does not poll, so visual
   * countdown precision lives at the request-cadence of `usePlan()`.
   */
  now?: Date;
}

export function TrialBanner({ now }: TrialBannerProps = {}) {
  const navigate = useNavigate();
  const { subscription, isLoading } = usePlan();

  const trialEndsAt = useMemo(() => {
    if (!subscription) return null;
    if (subscription.status !== "trialing") return null;
    return parseTrialEnd(subscription.currentPeriodEnd);
  }, [subscription]);

  const referenceNow = now ?? new Date();
  const remainingDays = trialEndsAt
    ? daysRemaining(trialEndsAt, referenceNow)
    : 0;
  const isInThreshold =
    trialEndsAt !== null &&
    remainingDays > 0 &&
    remainingDays <= SHOW_WITHIN_DAYS;

  const dismissalKey = trialEndsAt ? trialEndsAt.toISOString() : "";
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissalKey) return false;
    return safeReadStringLS(STORAGE_KEY) === dismissalKey;
  });

  useEffect(() => {
    if (!dismissalKey) {
      setDismissed(false);
      return;
    }
    setDismissed(safeReadStringLS(STORAGE_KEY) === dismissalKey);
  }, [dismissalKey]);

  if (isLoading || !isInThreshold || dismissed) return null;

  function handleCta() {
    navigate("/pricing");
  }

  function handleDismiss() {
    safeWriteLS(STORAGE_KEY, dismissalKey);
    setDismissed(true);
  }

  return (
    <Banner
      variant="warning"
      role="status"
      aria-live="polite"
      data-testid="trial-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">
          {`${TEXTS.messageLead} ${formatDaysUa(remainingDays)}.`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleCta}>
            {TEXTS.ctaSubscribe}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={TEXTS.dismissAriaLabel}
            onClick={handleDismiss}
          >
            {TEXTS.ctaDismiss}
          </Button>
        </div>
      </div>
    </Banner>
  );
}
