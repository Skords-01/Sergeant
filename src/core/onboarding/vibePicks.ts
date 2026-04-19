// Stores which Hub modules the user picked during onboarding ("vibes").
// Everything here is synchronous localStorage access — the wizard runs
// before React Query / cloud sync, so we keep it dependency-free.

const VIBE_PICKS_KEY = "hub_onboarding_vibes_v1";
const FIRST_ACTION_PENDING_KEY = "hub_first_action_pending_v1";
const FIRST_REAL_ENTRY_KEY = "hub_first_real_entry_done_v1";
const SOFT_AUTH_DISMISSED_KEY = "hub_soft_auth_dismissed_v1";
const DEMO_BANNER_DISMISSED_KEY = "hub_demo_banner_dismissed_v1";
// Millisecond epoch stamp captured the moment the user taps «Заповни
// мій хаб» on the splash. Used by `firstRealEntry.js` to compute the
// `ftux_time_to_value` duration — the single headline metric for the
// 30-second promise.
const FIRST_ACTION_STARTED_AT_KEY = "hub_first_action_started_at_v1";
const TTV_MS_KEY = "hub_ftux_ttv_ms_v1";

/** @typedef {"finyk" | "fizruk" | "routine" | "nutrition"} HubModuleId */

/** @type {HubModuleId[]} */
export const ALL_MODULES = ["finyk", "fizruk", "routine", "nutrition"];

/**
 * @param {unknown} raw
 * @returns {HubModuleId[]}
 */
function sanitizePicks(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (!ALL_MODULES.includes(/** @type {HubModuleId} */ v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(/** @type {HubModuleId} */ v);
  }
  return out;
}

/** @returns {HubModuleId[]} */
export function getVibePicks() {
  try {
    const raw = localStorage.getItem(VIBE_PICKS_KEY);
    if (!raw) return [];
    return sanitizePicks(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * @param {HubModuleId[]} picks
 */
export function saveVibePicks(picks) {
  try {
    const clean = sanitizePicks(picks);
    localStorage.setItem(VIBE_PICKS_KEY, JSON.stringify(clean));
  } catch {
    /* noop */
  }
}

export function markFirstActionPending() {
  try {
    localStorage.setItem(FIRST_ACTION_PENDING_KEY, "1");
  } catch {
    /* noop */
  }
}

export function clearFirstActionPending() {
  try {
    localStorage.removeItem(FIRST_ACTION_PENDING_KEY);
  } catch {
    /* noop */
  }
}

export function isFirstActionPending() {
  try {
    return localStorage.getItem(FIRST_ACTION_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstRealEntryDone() {
  try {
    localStorage.setItem(FIRST_REAL_ENTRY_KEY, "1");
  } catch {
    /* noop */
  }
}

export function isFirstRealEntryDone() {
  try {
    return localStorage.getItem(FIRST_REAL_ENTRY_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissDemoBanner() {
  try {
    localStorage.setItem(DEMO_BANNER_DISMISSED_KEY, "1");
  } catch {
    /* noop */
  }
}

export function isDemoBannerDismissed() {
  try {
    return localStorage.getItem(DEMO_BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function isSoftAuthDismissed() {
  try {
    return localStorage.getItem(SOFT_AUTH_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissSoftAuth() {
  try {
    localStorage.setItem(SOFT_AUTH_DISMISSED_KEY, "1");
  } catch {
    /* noop */
  }
}

/**
 * Start the 30-second FTUX clock. Called the moment the splash CTA is
 * tapped so `getTimeToValueMs()` (computed on first real entry) has a
 * deterministic origin regardless of routing/navigation timing.
 *
 * Idempotent: does nothing if a timestamp is already recorded — a user
 * who bounces in and out of /welcome shouldn't reset the clock.
 */
export function markFirstActionStartedAt() {
  try {
    if (localStorage.getItem(FIRST_ACTION_STARTED_AT_KEY)) return;
    localStorage.setItem(FIRST_ACTION_STARTED_AT_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}

/**
 * @returns {number | null} epoch ms, or `null` if the stamp is missing
 *   (returning users / anyone who completed onboarding before this ship).
 */
export function getFirstActionStartedAt() {
  try {
    const v = localStorage.getItem(FIRST_ACTION_STARTED_AT_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Persist the final time-to-value (ms from splash CTA tap to first
 * real entry). The celebration toast reads this so the number is
 * stable across re-renders even though the source timestamp is cleared.
 *
 * @param {number} ms
 */
export function saveTimeToValueMs(ms) {
  try {
    if (!Number.isFinite(ms) || ms < 0) return;
    localStorage.setItem(TTV_MS_KEY, String(Math.round(ms)));
  } catch {
    /* noop */
  }
}

/**
 * @returns {number | null} ms, or `null` if not yet measured.
 */
export function getTimeToValueMs() {
  try {
    const v = localStorage.getItem(TTV_MS_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
