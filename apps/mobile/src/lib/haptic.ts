/**
 * Mobile adapter for the shared haptic contract.
 *
 * Maps the six contract primitives to `expo-haptics`:
 *  - `tap`      → `Haptics.selectionAsync()` (subtle UI select feedback);
 *  - `success`  → `Haptics.notificationAsync(Success)`;
 *  - `warning`  → `Haptics.notificationAsync(Warning)`;
 *  - `error`    → `Haptics.notificationAsync(Error)`;
 *  - `cancel`   → a light impact (`ImpactFeedbackStyle.Light`) — there is
 *    no native "cancel" haptic, so we fall back to the lightest impact
 *    the user still perceives;
 *  - `pattern`  → intentional no-op (see note below).
 *
 * Importing this module has the side-effect of registering the mobile
 * adapter on the shared contract. Do this once from `app/_layout.tsx`.
 */

import * as Haptics from "expo-haptics";

import { setHapticAdapter, type HapticAdapter } from "@sergeant/shared";

function safe(run: () => Promise<unknown> | void): void {
  try {
    void run();
  } catch {
    /* expo-haptics rejects on web / unsupported hardware — swallow */
  }
}

export const mobileHapticAdapter: HapticAdapter = {
  tap: () => safe(() => Haptics.selectionAsync()),
  success: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
  error: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
  cancel: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // TODO: React Native / expo-haptics does not expose a vibrate-pattern
  // API comparable to `navigator.vibrate([on, off, on, …])`. Android's
  // Vibrator API restricts custom patterns on API 30+ without the
  // VIBRATE permission, and iOS has no public custom-pattern hook.
  // If we ever need cadenced haptics on mobile we can gate behind a
  // Platform check and call `Vibration.vibrate(pattern)` from
  // `react-native`.
  pattern: () => {},
};

setHapticAdapter(mobileHapticAdapter);
