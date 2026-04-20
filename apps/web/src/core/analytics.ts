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
  // 30-second FTUX funnel. Each step narrows the gap between "first open"
  // and "user felt real value", so every transition has a named event.
  ONBOARDING_VIBE_PICKED: "onboarding_vibe_picked",
  ONBOARDING_FIRST_ACTION_SHOWN: "onboarding_first_action_shown",
  ONBOARDING_FIRST_ACTION_PICKED: "onboarding_first_action_picked",
  FTUX_PRESET_SHEET_SHOWN: "ftux_preset_sheet_shown",
  FTUX_PRESET_PICKED: "ftux_preset_picked",
  FTUX_PRESET_CUSTOM: "ftux_preset_custom",
  FIRST_REAL_ENTRY: "first_real_entry",
  // Headline metric: milliseconds from splash CTA tap to first real
  // (non-demo) entry anywhere in the app. Target p50 < 20_000.
  FTUX_TIME_TO_VALUE: "ftux_time_to_value",
  AUTH_PROMPT_SHOWN: "auth_prompt_shown",
  AUTH_PROMPT_DISMISSED: "auth_prompt_dismissed",
  AUTH_AFTER_VALUE: "auth_after_value",
});

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
    console.log("[analytics]", event);
  } catch {}
}
