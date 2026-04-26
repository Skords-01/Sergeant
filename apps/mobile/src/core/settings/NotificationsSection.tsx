/**
 * Sergeant Hub-core — NotificationsSection (React Native, first cut)
 *
 * Mobile port of `apps/web/src/core/settings/NotificationsSection.tsx`.
 *
 * Within-reach parity (does the real thing now):
 *  - Native push-permission status card (first UI element on the
 *    section). Reads `Notifications.getPermissionsAsync()` on mount
 *    and wires a `Дозволити сповіщення` button to
 *    `Notifications.requestPermissionsAsync()`. `denied` surfaces a
 *    secondary `Відкрити налаштування` button that calls
 *    `Linking.openSettings()` — mirrors the web "open browser
 *    settings" hint but actionable on mobile (iOS/Android bury the
 *    system-notifications toggle deep enough that a one-tap shortcut
 *    is the whole UX).
 *  - Routine-reminders toggle — persists a plain boolean into the
 *    shared `@routine_prefs_v1` MMKV slice used by `RoutineSection`.
 *    The preference rides cloud-sync under the same envelope as the
 *    rest of the routine prefs, so when `@sergeant/routine` ports the
 *    scheduler (Phase 5) it can pick this flag up without a data
 *    migration.
 *
 * Deferred (tracked in `docs/react-native-migration.md` Phase 2 /
 * Hub-core, section 2.4) — rendered as `DeferredNotice` cards mirroring
 * `GeneralSection`:
 *  - **Routine scheduler.** The toggle above only flips the pref; the
 *    actual `Notifications.scheduleNotificationAsync` wiring lands
 *    with the Routine module port (Phase 5). Notice spells that out so
 *    users don't expect reminders to fire from this screen alone.
 *  - **Fizruk monthly-plan reminder** (web `useMonthlyPlan` — toggle +
 *    hour/minute picker). Ports with the Fizruk module (Phase 6).
 *  - **Nutrition reminders** (web `loadNutritionPrefs` / toggle + hour
 *    input). Ports with the Nutrition module (Phase 7).
 *
 * Notes on the permission-status model:
 *  - `expo-notifications` returns a `PermissionStatus` of
 *    `"granted" | "denied" | "undetermined"`. Web's fourth state
 *    (`"unsupported"` — no global `Notification` constructor) has no
 *    native equivalent: `expo-notifications` is always available on
 *    iOS/Android. The labels therefore collapse down to three.
 *  - iOS `provisional` authorisation is treated as `granted`
 *    (matches `registerPush.ensurePermissions` in
 *    `apps/mobile/src/features/push/registerPush.ts`).
 */

import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import * as Notifications from "expo-notifications";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLocalStorage } from "@/lib/storage";

import {
  SettingsGroup,
  SettingsSubGroup,
  ToggleRow,
} from "./SettingsPrimitives";

type PermStatus = "granted" | "denied" | "undetermined";

const PERM_LABELS: Record<PermStatus, string> = {
  granted: "Дозволено",
  denied: "Заблоковано",
  undetermined: "Не встановлено",
};

const PERM_TEXT_CLASS: Record<PermStatus, string> = {
  granted: "text-emerald-600",
  denied: "text-rose-600",
  undetermined: "text-amber-600",
};

// Mirrors the web `routine.prefs.routineRemindersEnabled` slice; the
// mobile `RoutineSection` uses the same key for its calendar-visibility
// flags so both port together when the shared routine store lands.
const ROUTINE_PREFS_KEY = "@routine_prefs_v1";

interface RoutinePrefs {
  routineRemindersEnabled?: boolean;
  showFizrukInCalendar?: boolean;
  showFinykSubscriptionsInCalendar?: boolean;
}

function DeferredNotice({ children }: { children: string }) {
  return (
    <Card variant="flat" radius="md" padding="md" className="border-dashed">
      <Text className="text-xs text-fg-muted leading-snug">{children}</Text>
    </Card>
  );
}

function isGranted(perm: Notifications.NotificationPermissionsStatus): boolean {
  if (perm.granted) return true;
  return perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function toStatus(
  perm: Notifications.NotificationPermissionsStatus,
): PermStatus {
  if (isGranted(perm)) return "granted";
  if (perm.status === "denied") return "denied";
  return "undetermined";
}

export function NotificationsSection() {
  const [permStatus, setPermStatus] = useState<PermStatus>("undetermined");
  const [routinePrefs, setRoutinePrefs] = useLocalStorage<RoutinePrefs>(
    ROUTINE_PREFS_KEY,
    {},
  );

  const refreshPermissions = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setPermStatus(toStatus(perm));
    } catch {
      // Native modules can throw on some simulators / dev builds
      // without the notifications entitlement — treat as undetermined
      // rather than crashing the settings screen.
      setPermStatus("undetermined");
    }
  }, []);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const requestPermission = useCallback(async () => {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      setPermStatus(toStatus(perm));
    } catch {
      setPermStatus("denied");
    }
  }, []);

  const openSystemSettings = useCallback(() => {
    // `Linking.openSettings()` is the RN-standard way to jump to the
    // app's entry in the OS settings. On iOS it lands on the app
    // permission sheet (notifications toggle visible); on Android on
    // the app details page (user taps "Notifications" from there).
    void Linking.openSettings();
  }, []);

  const routineEnabled = routinePrefs.routineRemindersEnabled === true;

  return (
    <SettingsGroup title="Сповіщення" emoji="🔔">
      <Card variant="flat" radius="md" padding="md">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-fg">
              Push-сповіщення
            </Text>
            <Text
              className={`text-xs mt-0.5 font-medium ${PERM_TEXT_CLASS[permStatus]}`}
              testID="notifications-permission-status"
            >
              {PERM_LABELS[permStatus]}
            </Text>
          </View>
          {permStatus === "undetermined" ? (
            <Button
              size="sm"
              onPress={requestPermission}
              testID="notifications-request-permission"
            >
              Дозволити
            </Button>
          ) : null}
          {permStatus === "denied" ? (
            <Button
              size="sm"
              variant="secondary"
              onPress={openSystemSettings}
              testID="notifications-open-settings"
            >
              Налаштування
            </Button>
          ) : null}
        </View>
        {permStatus === "denied" ? (
          <Text className="text-xs text-fg-muted mt-2 leading-snug">
            Сповіщення заблоковано у системних налаштуваннях. Увімкни їх там,
            щоб отримувати нагадування.
          </Text>
        ) : null}
      </Card>

      <SettingsSubGroup title="Звички (Рутина)">
        <ToggleRow
          label="Нагадування про звички"
          description="Спрацьовує у встановлений в кожній звичці час. Повноцінне планування нагадувань підключиться з портом модуля Рутина (Phase 5) — зараз значення зберігається і буде підхоплено автоматично."
          checked={routineEnabled}
          onChange={(next) =>
            setRoutinePrefs((prev) => ({
              ...prev,
              routineRemindersEnabled: next,
            }))
          }
          testID="notifications-routine-toggle"
        />
      </SettingsSubGroup>

      {/* TODO(mobile-migration, Phase 6): wire to `useMonthlyPlan` once
          the Fizruk module is ported — reminderEnabled + reminderHour /
          reminderMinute picker, analogue to web `NotificationsSection`
          Фізрук sub-group. */}
      <SettingsSubGroup title="Тренування (Фізрук)">
        <DeferredNotice>
          Нагадування про тренування підключаться з портом модуля Фізрук (Phase
          6).
        </DeferredNotice>
      </SettingsSubGroup>

      {/* TODO(mobile-migration, Phase 7): wire to the nutrition-prefs
          slice once the Nutrition module is ported — reminderEnabled +
          reminderHour picker, analogue to web `NotificationsSection`
          Харчування sub-group. */}
      <SettingsSubGroup title="Харчування">
        <DeferredNotice>
          Нагадування про їжу підключаться з портом модуля Харчування (Phase 7).
        </DeferredNotice>
      </SettingsSubGroup>
    </SettingsGroup>
  );
}
