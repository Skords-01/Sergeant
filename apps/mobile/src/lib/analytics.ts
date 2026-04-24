/**
 * Mobile analytics sink (Phase 1).
 *
 * Today this is a console logger only — mirrors web's `trackEvent`
 * contract so call sites can stay consistent across platforms.
 */
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@sergeant/shared";

export { ANALYTICS_EVENTS };

export function trackEvent(
  eventName: AnalyticsEventName | string,
  payload?: object,
) {
  if (!eventName || typeof eventName !== "string") return;
  try {
    console.log("[analytics]", {
      eventName,
      payload: payload && typeof payload === "object" ? payload : {},
      timestamp: new Date().toISOString(),
    });
  } catch {
    /* noop */
  }
}
