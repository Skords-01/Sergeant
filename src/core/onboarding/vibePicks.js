// Stores which Hub modules the user picked during onboarding ("vibes").
// Everything here is synchronous localStorage access — the wizard runs
// before React Query / cloud sync, so we keep it dependency-free.

export const VIBE_PICKS_KEY = "hub_onboarding_vibes_v1";
export const FIRST_ACTION_PENDING_KEY = "hub_first_action_pending_v1";
export const FIRST_REAL_ENTRY_KEY = "hub_first_real_entry_done_v1";
export const SOFT_AUTH_DISMISSED_KEY = "hub_soft_auth_dismissed_v1";

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
    if (!ALL_MODULES.includes(/** @type {HubModuleId} */ (v))) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(/** @type {HubModuleId} */ (v));
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
