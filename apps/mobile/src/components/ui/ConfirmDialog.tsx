/**
 * Sergeant Design System — ConfirmDialog (React Native)
 *
 * Mobile port of the web `ConfirmDialog` — a bottom-sheet-style
 * confirmation shell with a title, optional description, and a
 * confirm / cancel button pair. Wraps React Native's built-in
 * `Modal` (transparent) so we can render above the current screen
 * without adding a third-party bottom-sheet dependency.
 *
 * @see apps/web/src/shared/components/ui/ConfirmDialog.tsx — canonical source of truth
 *
 * Parity notes:
 * - Same external API: `open`, `title?`, `description?`,
 *   `confirmLabel?`, `cancelLabel?`, `danger?`, `onConfirm?`,
 *   `onCancel?`.
 * - Same Ukrainian defaults (`"Підтвердити дію"` / `"Видалити"` /
 *   `"Скасувати"`) and `danger=true` preset (destructive primary).
 * - Same vertical action stack: destructive / primary confirm above
 *   a ghost cancel, each full-width via the shared `Button` primitive.
 *
 * Differences from web (intentional):
 * - Overlay is RN's built-in `Modal` (`transparent`, `animationType
 *   ="fade"`) — no `@gorhom/bottom-sheet`, no `react-native-modal`.
 * - Android hardware back dismisses via `Modal.onRequestClose` →
 *   `onCancel`.
 * - `role="dialog" + aria-labelledby` → `accessibilityRole
 *   ="alertdialog"` + `accessibilityLabel` derived from `title`, plus
 *   `accessibilityViewIsModal` so iOS VoiceOver traps focus on the
 *   card.
 * - `useDialogFocusTrap` + body scroll lock are dropped — RN's Modal
 *   already owns focus and blocks underlying touches.
 * - Respects `AccessibilityInfo.isReduceMotionEnabled()` (WCAG 2.3.3
 *   parity): when the user has "Reduce Motion" on, the Modal uses
 *   `animationType="none"`.
 * - Semantic tokens (`bg-panel`, `border-line`, `text-text`,
 *   `text-muted`) now resolve through CSS variables in `global.css`.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  Text,
  View,
  type AccessibilityRole,
} from "react-native";

import { Button } from "./Button";

// RN's `AccessibilityRole` union doesn't yet include `"alertdialog"` (the
// WAI-ARIA role the web port targets). The string is still forwarded to
// the platform accessibility layer, so we cast through to preserve parity.
const ALERT_DIALOG_ROLE = "alertdialog" as AccessibilityRole;

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
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

  return reduceMotion;
}

export function ConfirmDialog({
  open,
  title = "Підтвердити дію",
  description,
  confirmLabel = "Видалити",
  cancelLabel = "Скасувати",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const reduceMotion = useReduceMotion();

  if (!open) return null;

  const handleRequestClose = () => {
    onCancel?.();
  };

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-end px-4 pb-4">
        {/* Scrim — Pressable keeps dismiss reachable for AT. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onCancel}
          testID="confirm-dialog-scrim"
          className="absolute inset-0 bg-fg/40"
        />

        {/* Card */}
        <View
          accessibilityViewIsModal
          accessibilityRole={ALERT_DIALOG_ROLE}
          accessibilityLabel={title}
          className="w-full max-w-sm bg-cream-50 border border-cream-300 rounded-3xl p-6 shadow-lg"
        >
          <Text className="text-[17px] font-bold text-fg mb-2 leading-snug">
            {title}
          </Text>
          {typeof description === "string" ||
          typeof description === "number" ? (
            <Text className="text-sm text-fg-muted leading-relaxed mb-5">
              {description}
            </Text>
          ) : description ? (
            <View className="mb-5">{description}</View>
          ) : null}
          <View className="flex-col gap-2">
            <Button
              variant={danger ? "destructive" : "primary"}
              size="lg"
              className="w-full"
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onPress={onCancel}
            >
              {cancelLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
