/**
 * Reset onboarding + FTUX state without wiping the user's actual data.
 *
 * Used by "Restart onboarding" in Settings. This deliberately does NOT
 * remove domain data (finyk/nutrition/etc). It only clears gates and
 * funnel flags so the welcome flow + first-action guidance can re-run.
 */
import { type KVStore } from "./kvStore";
import { clearOnboardingDone } from "./onboarding";
import {
  FIRST_ACTION_PENDING_KEY,
  FIRST_ACTION_STARTED_AT_KEY,
  FIRST_REAL_ENTRY_KEY,
  TTV_MS_KEY,
  VIBE_PICKS_KEY,
  SOFT_AUTH_DISMISSED_KEY,
} from "./vibePicks";
import { clearAllHintsState } from "./hints";

export function resetOnboardingState(store: KVStore): void {
  clearOnboardingDone(store);
  store.remove(VIBE_PICKS_KEY);
  store.remove(FIRST_ACTION_PENDING_KEY);
  store.remove(FIRST_ACTION_STARTED_AT_KEY);
  store.remove(FIRST_REAL_ENTRY_KEY);
  store.remove(TTV_MS_KEY);
  store.remove(SOFT_AUTH_DISMISSED_KEY);
  clearAllHintsState(store);
}

