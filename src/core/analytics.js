// Lightweight product analytics sink.
//
// Currently this is a console logger only — it gives us a single place to
// wire `trackEvent` calls from the product and later swap the transport to
// PostHog / Amplitude / a proxy endpoint without touching call sites.
//
// Contract:
//   - `trackEvent(name, payload?)` is fire-and-forget. It never throws
//     and never returns a Promise that callers need to await.
//   - Payload is expected to be a small plain object with NO sensitive
//     data (no tokens, emails, amounts linked to a real identity, etc.).
//
// When we add a real provider we will only change this file.

/** @typedef {{ eventName: string, payload: object, timestamp: string }} AnalyticsEvent */

/**
 * Canonical event names used across the app. Using the constants avoids
 * typos and makes it easy to grep for every call site.
 */
export const ANALYTICS_EVENTS = Object.freeze({
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  EXPENSE_ADDED: "expense_added",
  EXPENSE_DELETED: "expense_deleted",
  BUDGET_SET: "budget_set",
  ANALYTICS_OPENED: "analytics_opened",
  BANK_CONNECT_STARTED: "bank_connect_started",
  BANK_CONNECT_SUCCESS: "bank_connect_success",
  PAYWALL_VIEWED: "paywall_viewed",
  // Activation funnel — fired at most once per user to measure time-to-value.
  FIRST_EXPENSE_ADDED: "first_expense_added",
  FIRST_INSIGHT_SEEN: "first_insight_seen",
});

/**
 * @typedef {{
 *   name: string,
 *   track: (event: AnalyticsEvent) => void,
 * }} AnalyticsProvider
 */

/** @type {AnalyticsProvider[]} */
const providers = [];

/**
 * Register a transport (e.g. PostHog / Amplitude wrapper). Providers must
 * be resilient — any thrown error is swallowed so analytics can never
 * break the UI.
 * @param {AnalyticsProvider} provider
 */
export function registerAnalyticsProvider(provider) {
  if (!provider || typeof provider.track !== "function") return;
  providers.push(provider);
}

/** Clear all registered providers. Primarily useful in tests. */
export function resetAnalyticsProviders() {
  providers.length = 0;
}

function safeDispatch(event) {
  for (const p of providers) {
    try {
      p.track(event);
    } catch (err) {
      // Never let a misbehaving provider impact the UI.
      console.warn(`[analytics] provider "${p.name}" failed`, err);
    }
  }
}

/**
 * Record a product event. Fire-and-forget — safe to call from any UI
 * handler without awaiting.
 *
 * @param {string} eventName - Canonical event name, see `ANALYTICS_EVENTS`.
 * @param {object} [payload] - Minimal, non-sensitive metadata.
 */
export function trackEvent(eventName, payload = {}) {
  if (!eventName || typeof eventName !== "string") return;
  const event = {
    eventName,
    payload: payload && typeof payload === "object" ? payload : {},
    timestamp: new Date().toISOString(),
  };
  try {
    // Stage 1: just log. Real transports will be registered via
    // `registerAnalyticsProvider` once we pick a vendor.
    console.log("[analytics]", event);
  } catch {}
  safeDispatch(event);
}
