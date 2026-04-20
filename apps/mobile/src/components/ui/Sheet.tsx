/**
 * Sergeant Design System — Sheet (React Native)
 *
 * Mobile port of the canonical bottom-sheet shell used across Фінік /
 * Фізрук / Рутина / Харчування.
 *
 * @see apps/web/src/shared/components/ui/Sheet.tsx — canonical source of truth
 *
 * Parity notes:
 * - Same call-site shape: `open` / `onClose` / `title` / `description` /
 *   `children` / `footer`.
 * - Same WCAG tap-target guarantee for the close button (44×44, served
 *   by the shared `Button` primitive with `iconOnly` + `size="md"`).
 * - Same dismiss affordances: scrim press + dedicated close button.
 *   Web adds Escape-key via focus-trap; mobile adds Android hardware
 *   back via `Modal.onRequestClose`.
 * - Same "header owns title / optional description, body owns scroll,
 *   footer is sticky outside the scroll region" layout.
 *
 * Differences from web (intentional):
 * - Built on React Native's built-in `Modal` (transparent,
 *   `animationType="slide"`). No `@gorhom/bottom-sheet`, no
 *   `react-native-modal`, no Reanimated — keeps the bundle and jest
 *   transform list unchanged.
 * - Focus trap is handled by the native `Modal` (`accessibilityViewIsModal`
 *   confines VoiceOver / TalkBack focus to the sheet); no web
 *   `useDialogFocusTrap` hook is needed.
 * - Soft-keyboard handling via `KeyboardAvoidingView` (`behavior="padding"`
 *   on iOS, no-op on Android where `android:windowSoftInputMode`
 *   already adjusts the window) instead of the web `kbInsetPx` prop.
 * - Respects `AccessibilityInfo.isReduceMotionEnabled()` — when enabled
 *   we drop the slide animation to `animationType="none"` per WCAG
 *   2.3.3 / Apple HIG. Same approach as `Skeleton` (PR #423).
 * - `role="dialog"` is applied via the RN ≥0.71 ARIA-role prop on the
 *   panel wrapper; the legacy `accessibilityRole` union has no
 *   `"dialog"` member.
 * - Semantic tokens (`bg-panel`, `border-line`, `text-text`,
 *   `text-subtle`) fall back to concrete `cream-*` / `stone-*` classes
 *   until mobile CSS-variable wiring lands — same caveat as every
 *   other phase-1 primitive.
 *   TODO: align with design-tokens once mobile semantic variables land.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "./Button";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title — rendered in the header and used for `accessibilityLabel`. */
  title: string;
  /** Optional subtitle rendered under the title. */
  description?: string;
  /** Main sheet body. */
  children?: ReactNode;
  /** Sticky footer (e.g. action buttons). Rendered inside the panel, outside the scroll area. */
  footer?: ReactNode;
  /** Accessible label for the close button. Defaults to "Закрити". */
  closeLabel?: string;
  /** Max panel height as a fraction of the viewport (0–1). Defaults to 0.9. */
  maxHeight?: number;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = "Закрити",
  maxHeight = 0.9,
}: SheetProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // Ignore — default to motion-enabled on platforms / versions
        // that don't expose the API.
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

  // Bail out before rendering the Modal to keep children fully
  // unmounted while closed. Matches the web guard (`if (!open) return
  // null;`) and avoids keeping child state alive between opens.
  if (!open) return null;

  const heightFraction = Math.max(0.1, Math.min(1, maxHeight));

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={title}
    >
      <View className="flex-1 justify-end">
        {/* Scrim. A `Pressable` makes the dismiss discoverable to AT
            the same way the web <button> scrim does. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          className="absolute inset-0 bg-black/40"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <SafeAreaView
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel={title}
            className={cx(
              "bg-cream-50 border-t border-cream-300 rounded-t-3xl shadow-lg",
            )}
            style={{ maxHeight: `${heightFraction * 100}%` }}
          >
            <View className="flex items-center pt-3 pb-1">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="w-10 h-1 bg-cream-300 rounded-full"
              />
            </View>
            <View className="flex-row items-start justify-between gap-3 px-5 pt-1 pb-3">
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-stone-900 leading-tight">
                  {title}
                </Text>
                {description ? (
                  <Text className="text-xs text-stone-500 mt-1">
                    {description}
                  </Text>
                ) : null}
              </View>
              <Button
                variant="ghost"
                size="md"
                iconOnly
                onPress={onClose}
                accessibilityLabel={closeLabel}
                className="bg-cream-100"
              >
                <Text className="text-stone-500 text-lg font-bold">✕</Text>
              </Button>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              className="px-5 pb-4"
            >
              {children}
            </ScrollView>
            {footer ? (
              <View className="px-5 pt-3 pb-4 border-t border-cream-300 bg-cream-50">
                {footer}
              </View>
            ) : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
