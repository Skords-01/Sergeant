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
import { isFirstRealEntryDone, markFirstRealEntryDone } from "./vibePicks.js";

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

  // Nutrition — meal log is keyed by date; inspect items across all days.
  const nutrition = safeReadJSON("nutrition_log_v1");
  if (nutrition && typeof nutrition === "object" && !Array.isArray(nutrition)) {
    for (const day of Object.values(nutrition)) {
      if (day && hasNonDemoItem(day.items)) return true;
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
  return true;
}
