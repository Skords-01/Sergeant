// Detects the user's first *real* (non-demo) entry across any module and
// emits the `first_real_entry` event exactly once. This is the single
// source of truth for the "aha" moment that qualifies someone to see the
// soft auth prompt.
//
// Everything here is read-only scans of localStorage — no subscriptions,
// no polling — because the dashboard already re-renders on every module
// storage event (fizruk-storage, hub-routine-storage, nutrition-log, etc).
// We re-check on each render and fire the first-entry event once.

import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import {
  getFirstActionStartedAt,
  isFirstRealEntryDone,
  markFirstRealEntryDone,
  saveTimeToValueMs,
} from "./vibePicks.js";

function safeReadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasNonDemoItem(list) {
  if (!Array.isArray(list)) return false;
  return list.some((item) => item && typeof item === "object" && !item.demo);
}

/**
 * Returns true if the user has at least one non-demo entry anywhere.
 * Called on every dashboard render; O(modules) and cheap (no reserialize).
 *
 * Exported for the hub shell: «Звіти» tab is hidden until this becomes
 * true — an empty reports view is worse than no tab at all.
 */
export function hasAnyRealEntry() {
  // Finyk — manual expenses.
  const manual = safeReadJSON("finyk_manual_expenses_v1");
  if (hasNonDemoItem(manual)) return true;
  // A synced monobank tx cache counts as real data by definition.
  const finykCache = safeReadJSON("finyk_tx_cache");
  if (
    finykCache &&
    Array.isArray(finykCache.transactions) &&
    finykCache.transactions.length > 0
  ) {
    return true;
  }

  // Fizruk — workouts.
  const fizruk = safeReadJSON("fizruk_workouts_v1");
  const workouts = Array.isArray(fizruk)
    ? fizruk
    : fizruk && Array.isArray(fizruk.workouts)
      ? fizruk.workouts
      : [];
  if (hasNonDemoItem(workouts)) return true;

  // Routine — habits. Demo habits are marked `demo: true`; any habit
  // without the flag counts as real (user-created).
  const routine = safeReadJSON("hub_routine_v1");
  if (routine && hasNonDemoItem(routine.habits)) return true;

  // Nutrition — meal log is keyed by date; inspect meals across all days.
  // The day shape is `{ meals: [...] }` (see `normalizeNutritionLog`).
  const nutrition = safeReadJSON("nutrition_log_v1");
  if (nutrition && typeof nutrition === "object" && !Array.isArray(nutrition)) {
    for (const day of Object.values(nutrition as Record<string, unknown>)) {
      const meals = (day as { meals?: unknown })?.meals;
      if (day && hasNonDemoItem(meals)) return true;
    }
  }

  return false;
}

/**
 * Call on every render of the dashboard. If the user has a real entry and
 * we haven't fired yet, fire `first_real_entry` and persist the flag so
 * this becomes a no-op for all future renders.
 *
 * @returns {boolean} true if the user now has at least one real entry
 */
export function detectFirstRealEntry() {
  if (isFirstRealEntryDone()) return true;
  if (!hasAnyRealEntry()) return false;
  markFirstRealEntryDone();
  trackEvent(ANALYTICS_EVENTS.FIRST_REAL_ENTRY);
  // Headline 30-second metric: how long did it actually take? The
  // start stamp is captured when the user taps «Заповни мій хаб» on
  // the splash. Missing stamp = returning user from a pre-Ship-3
  // install; we still fire `first_real_entry` but skip the TTV event.
  const startedAt = getFirstActionStartedAt();
  if (startedAt) {
    const durationMs = Math.max(0, Date.now() - startedAt);
    saveTimeToValueMs(durationMs);
    trackEvent(ANALYTICS_EVENTS.FTUX_TIME_TO_VALUE, {
      durationMs,
      durationSec: Math.round(durationMs / 1000),
    });
  }
  return true;
}
