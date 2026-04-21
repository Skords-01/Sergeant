/**
 * Mobile port of `apps/web/src/core/OnboardingWizard.tsx` (285 LOC).
 *
 * Keeps full parity with the web flow — single-step splash, default
 * "all four modules" selection, empty-picks fallback in `finish()` —
 * and reuses the shared pure domain (`@sergeant/shared/lib/onboarding`
 * + `vibePicks` + `firstRealEntry`) so both platforms cannot drift on
 * key constants, chip taxonomy or done-flag rules.
 *
 * Platform-specific behaviour:
 *  - Haptics via the shared adapter (`expo-haptics` registered in
 *    `apps/mobile/app/_layout.tsx`): `tap` on chip toggle, `success`
 *    on finish. Calls are no-ops when the user has Reduce Motion on
 *    AND the platform is iOS (haptics follow Reduce Motion there).
 *  - Respects `AccessibilityInfo.isReduceMotionEnabled()` for the
 *    enter animation: when motion is reduced the card fades in
 *    instantly; otherwise it uses RN's default modal slide-up.
 *  - Progress is persisted through the shared `KVStore` adapter that
 *    wraps the mobile storage helpers (no direct MMKV writes).
 *
 * Wiring: `app/(tabs)/_layout.tsx` checks `shouldShowOnboarding` on
 * mount and renders this wizard full-screen before any tabs paint.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  SafeAreaView,
  Text,
  View,
} from "react-native";

import {
  ALL_MODULES,
  buildFinalPicks,
  hapticSuccess,
  markFirstActionPending,
  markFirstActionStartedAt,
  markOnboardingDone,
  saveVibePicks,
  type DashboardModuleId,
  type KVStore,
} from "@sergeant/shared";

import {
  safeReadLS as mmkvGet,
  safeRemoveLS as mmkvRemove,
  safeWriteLS as mmkvWrite,
} from "@/lib/storage";

import { SplashStep } from "./onboarding/SplashStep";

/**
 * Mobile `KVStore` adapter backed by the shared MMKV helpers. Mirrors
 * the pattern already used in `core/dashboard/SoftAuthPromptCard.tsx`
 * so every shared helper on mobile talks to the same underlying
 * `sergeant.mobile.v1` instance.
 */
const mmkvStore: KVStore = {
  getString(key) {
    try {
      const raw = mmkvGet<unknown>(key, null);
      if (raw === null || raw === undefined) return null;
      return typeof raw === "string" ? raw : JSON.stringify(raw);
    } catch {
      return null;
    }
  },
  setString(key, value) {
    try {
      mmkvWrite(key, value);
    } catch {
      /* noop */
    }
  },
  remove(key) {
    try {
      mmkvRemove(key);
    } catch {
      /* noop */
    }
  },
};

/**
 * Exported for callers that need to talk to onboarding KV state from
 * the same adapter without touching MMKV directly (e.g. the tab
 * layout that reads `shouldShowOnboarding` on mount).
 */
export function getOnboardingStore(): KVStore {
  return mmkvStore;
}

export interface OnboardingFinishOptions {
  intent: "vibe_empty";
  picks: DashboardModuleId[];
}

export interface OnboardingWizardProps {
  /**
   * Called after `saveVibePicks` + `markFirstActionStartedAt` +
   * `markFirstActionPending` + `markOnboardingDone` all fire.
   * Matches the web signature: first arg is a `startModuleId` which
   * is always `null` from the splash path, second arg carries the
   * intent + normalised picks.
   */
  onDone: (
    startModuleId: DashboardModuleId | null,
    opts: OnboardingFinishOptions,
  ) => void;
  /**
   * "modal" wraps the splash in an RN `Modal` that covers the tab
   * bar; "fullPage" drops the Modal chrome so a parent route can
   * own the frame (e.g. a future `/welcome` screen). Defaults to
   * `modal` so callers get the same behaviour as the web OnboardingWizard.
   */
  variant?: "modal" | "fullPage";
}

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        /* unsupported — default to motion-on */
      });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(enabled),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduceMotion;
}

export function OnboardingWizard({
  onDone,
  variant = "modal",
}: OnboardingWizardProps) {
  // Default to "all four modules active" — matches the web lazy-path:
  // one tap finishes onboarding with every module visible on the hub.
  const [picks, setPicks] = useState<DashboardModuleId[]>(() => [
    ...ALL_MODULES,
  ]);
  const reduceMotion = useReduceMotion();

  const togglePick = useCallback((id: DashboardModuleId) => {
    setPicks((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const finish = useCallback(() => {
    const chosen = buildFinalPicks(picks, ALL_MODULES);
    saveVibePicks(mmkvStore, chosen);
    markFirstActionStartedAt(mmkvStore);
    markFirstActionPending(mmkvStore);
    markOnboardingDone(mmkvStore);
    hapticSuccess();
    onDone(null, { intent: "vibe_empty", picks: chosen });
  }, [onDone, picks]);

  const content = (
    <View
      testID="onboarding-splash-card"
      className="w-full max-w-sm rounded-3xl border border-cream-300 bg-cream-50 p-6"
    >
      <SplashStep picks={picks} togglePick={togglePick} onContinue={finish} />
    </View>
  );

  if (variant === "fullPage") {
    return (
      <SafeAreaView
        className="flex-1 bg-cream-50"
        accessibilityLabel="Вітальний екран"
        testID="onboarding-wizard"
      >
        <View className="flex-1 items-center justify-center p-4">
          {content}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={finish}
      accessibilityLabel="Вітальний екран"
      testID="onboarding-wizard"
    >
      <View className="flex-1 items-center justify-end bg-black/60 p-4">
        {/* Stretch the card to the sheet-style bottom layout on phones;
            pb-6 adds a little breathing room above the home indicator. */}
        <View className="w-full max-w-sm pb-6">
          <Text accessibilityRole="header" className="sr-only">
            Вітальний екран
          </Text>
          {content}
        </View>
      </View>
    </Modal>
  );
}
