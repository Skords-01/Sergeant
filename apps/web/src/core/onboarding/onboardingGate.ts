/**
 * Thin web adapter over `@sergeant/shared/lib/onboarding`. The shared
 * module owns key constants, the existing-data heuristic, the
 * done-flag lifecycle and the splash taxonomy (icons / teasers / chip
 * order). This file binds them to a `window.localStorage`-backed
 * `KVStore` so existing call-sites (`App.tsx`, `OnboardingWizard.tsx`,
 * `WelcomeScreen.tsx`) keep the exact same API they had before the
 * mobile port.
 */

import {
  type KVStore,
  buildFinalPicks as sharedBuildFinalPicks,
  hasExistingData as sharedHasExistingData,
  isOnboardingDone as sharedIsOnboardingDone,
  markOnboardingDone as sharedMarkOnboardingDone,
  shouldShowOnboarding as sharedShouldShowOnboarding,
} from "@sergeant/shared";

const localStorageStore: KVStore = {
  getString(key) {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  setString(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* noop */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

/**
 * True when the onboarding splash should render on this cold start.
 * Matches the pre-extraction behaviour byte-for-byte (the shared
 * helper eagerly marks "done" when it finds pre-existing data).
 */
export function shouldShowOnboarding(): boolean {
  return sharedShouldShowOnboarding(localStorageStore);
}

export function markOnboardingDone(): void {
  sharedMarkOnboardingDone(localStorageStore);
}

export function isOnboardingDone(): boolean {
  return sharedIsOnboardingDone(localStorageStore);
}

export function hasExistingData(): boolean {
  return sharedHasExistingData(localStorageStore);
}

export { sharedBuildFinalPicks as buildFinalPicks };
