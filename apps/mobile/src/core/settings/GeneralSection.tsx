/**
 * Sergeant Hub-core — GeneralSection (React Native, first cut)
 *
 * Mobile mirror of `apps/web/src/core/settings/GeneralSection.tsx`.
 *
 * Within-reach parity:
 *  - "Темна тема" toggle — persisted via MMKV under the shared
 *    `STORAGE_KEYS.HUB_PREFS` slice so the user's choice rides the
 *    same cloud-sync envelope as on web.
 *  - "Показувати AI-коуч" toggle — mirrors the web
 *    `useHubPref("showCoach", true)` semantics (default on;
 *    `prefs.showCoach !== false`).
 *
 * Dashboard reorder list:
 *  - Рендерить **видимий** підмножину модулей (без `nutrition` у
 *    `VISIBLE_DASHBOARD_MODULES`, поки Phase 7 Hub-gate) з ↑/↓ — a11y fallback
 *    for the long-press drag on the dashboard itself. State is shared
 *    with the dashboard via `useDashboardOrder` and persisted through
 *    the same `STORAGE_KEYS.DASHBOARD_ORDER` slice used by web.
 *
 * Deferred (tracked in `docs/react-native-migration.md` Phase 2 /
 * Hub-core, section 2.4):
 *  - **Cloud sync push / pull buttons.** Web passes `user` +
 *    `useCloudSync(user)` handlers from a screen wrapper.
 *    `CloudSyncProvider` already owns the scheduler on mobile, so
 *    a leaf component re-instantiating `useCloudSync` would
 *    double-mount NetInfo listeners and the periodic retry. A
 *    dedicated read/trigger hook lands in a follow-up; until then
 *    a `Card` notice explains the deferral inline.
 *  - **Local backup export / import.** `apps/mobile/src/lib/fileDownload.ts`
 *    ships a warn-only stub today (see that file's header — real
 *    `expo-file-system` + `expo-sharing` wiring is Phase 4+). Import
 *    would additionally need `expo-document-picker`, not yet a
 *    dependency. Placeholder `Card` here points at that follow-up.
 *
 * Dark-mode wiring:
 *  - Toggling "Темна тема" flips `prefs.darkMode` in the shared
 *    `STORAGE_KEYS.HUB_PREFS` MMKV slice.
 *  - `<ColorSchemeBridge />` (mounted in `apps/mobile/app/_layout.tsx`)
 *    subscribes to the same slice and calls
 *    `nativewind.colorScheme.set(...)`, which in turn re-tints every
 *    semantic-token surface (`bg-panel`, `text-fg`, `border-line`, …)
 *    via the `:root` ↔ `.dark` palette in `apps/mobile/global.css`.
 *  - Tri-state: `darkMode === true → "dark"`,
 *    `darkMode === false → "light"`, missing → `"system"` (follows OS).
 */

import { DeviceEventEmitter, Pressable, Text, View } from "react-native";
import {
  DASHBOARD_MODULE_LABELS,
  resetOnboardingState,
  STORAGE_KEYS,
  type KVStore,
} from "@sergeant/shared";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useDashboardOrder } from "@/core/dashboard/useDashboardOrder";
import {
  safeReadLS as mmkvGet,
  safeRemoveLS as mmkvRemove,
  safeWriteLS as mmkvWrite,
  useLocalStorage,
} from "@/lib/storage";

import {
  SettingsGroup,
  SettingsSubGroup,
  ToggleRow,
} from "./SettingsPrimitives";

interface HubPrefs {
  showCoach?: boolean;
  darkMode?: boolean;
  showHints?: boolean;
}

// Mirrors the web `hub_prefs_v1` key so cloud-synced prefs live in a
// single slice across platforms. See
// `apps/web/src/core/settings/hubPrefs.ts`.
const HUB_PREFS_KEY = STORAGE_KEYS.HUB_PREFS;

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

function DeferredNotice({ children }: { children: string }) {
  return (
    <Card variant="flat" radius="md" padding="md" className="border-dashed">
      <Text className="text-xs text-fg-muted leading-snug">{children}</Text>
    </Card>
  );
}

function ModuleReorderList() {
  const { visibleOrder, reorderVisible } = useDashboardOrder();

  if (visibleOrder.length === 0) {
    return (
      <DeferredNotice>
        Поки що жоден модуль не відображається на дашборді.
      </DeferredNotice>
    );
  }

  return (
    <View className="overflow-hidden rounded-xl border border-cream-300">
      {visibleOrder.map((id, index) => {
        const isFirst = index === 0;
        const isLast = index === visibleOrder.length - 1;
        const label = DASHBOARD_MODULE_LABELS[id];
        return (
          <View
            key={id}
            className={`flex-row items-center gap-2 bg-cream-50 px-3 py-2 ${
              isFirst ? "" : "border-t border-cream-300"
            }`}
          >
            <Text className="w-4 text-xs font-semibold text-fg-muted tabular-nums">
              {index + 1}
            </Text>
            <Text className="flex-1 text-sm text-fg" numberOfLines={1}>
              {label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Підняти ${label} вище`}
              accessibilityState={{ disabled: isFirst }}
              disabled={isFirst}
              onPress={() => reorderVisible(index, index - 1)}
              className={`h-8 w-8 items-center justify-center rounded-lg ${
                isFirst ? "opacity-30" : "active:bg-cream-200"
              }`}
              testID={`dashboard-reorder-up-${id}`}
            >
              <Text className="text-sm text-fg-muted">▲</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Опустити ${label} нижче`}
              accessibilityState={{ disabled: isLast }}
              disabled={isLast}
              onPress={() => reorderVisible(index, index + 1)}
              className={`h-8 w-8 items-center justify-center rounded-lg ${
                isLast ? "opacity-30" : "active:bg-cream-200"
              }`}
              testID={`dashboard-reorder-down-${id}`}
            >
              <Text className="text-sm text-fg-muted">▼</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function GeneralSection() {
  const [prefs, setPrefs] = useLocalStorage<HubPrefs>(HUB_PREFS_KEY, {});

  // Web mirrors `useHubPref("showCoach", true)` — default-on, so we
  // read `prefs.showCoach !== false` to preserve that behaviour when
  // the pref hasn't been touched yet.
  const showCoach = prefs.showCoach !== false;
  const dark = prefs.darkMode === true;
  const showHints = prefs.showHints !== false;

  return (
    <SettingsGroup title="Загальні" emoji="⚙️">
      <ToggleRow
        label="Темна тема"
        checked={dark}
        onChange={(next) => setPrefs((prev) => ({ ...prev, darkMode: next }))}
        testID="general-dark-mode-toggle"
      />
      <SettingsSubGroup title="Дашборд">
        <ToggleRow
          label="Показувати AI-коуч"
          description="Блок з щоденною порадою коуча на головному екрані."
          checked={showCoach}
          onChange={(next) =>
            setPrefs((prev) => ({ ...prev, showCoach: next }))
          }
          testID="general-show-coach-toggle"
        />
        <ToggleRow
          label="Показувати підказки"
          description="Короткі підказки в моменті (без спаму)."
          checked={showHints}
          onChange={(next) =>
            setPrefs((prev) => ({ ...prev, showHints: next }))
          }
          testID="general-show-hints-toggle"
        />
      </SettingsSubGroup>
      <SettingsSubGroup title="Онбординг">
        <Text className="text-xs text-fg-muted leading-snug">
          Перезапуск не видаляє твої дані — лише повертає вітальний екран та
          підказки першого запуску.
        </Text>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            resetOnboardingState(mmkvStore);
            DeviceEventEmitter.emit("hub:onboardingReset");
          }}
          testID="general-restart-onboarding"
        >
          Перезапустити онбординг
        </Button>
      </SettingsSubGroup>
      <SettingsSubGroup title="Упорядкувати модулі">
        <ModuleReorderList />
      </SettingsSubGroup>
      <SettingsSubGroup title="Хмарна синхронізація">
        <DeferredNotice>
          Кнопки ручного збереження та завантаження з хмари підключаться у
          наступному PR — разом із read-only хуком, який не дублюватиме вже
          активний CloudSyncProvider.
        </DeferredNotice>
      </SettingsSubGroup>
      <SettingsSubGroup title="Резервна копія Hub">
        <DeferredNotice>
          Експорт та імпорт JSON-резервної копії чекають реального
          mobile-адаптера downloadJson (expo-file-system + expo-sharing) —
          сьогодні у коді є тільки warn-only заглушка.
        </DeferredNotice>
      </SettingsSubGroup>
      <View className="gap-1">
        <Text className="text-[11px] text-fg-subtle leading-snug">
          Решта опцій цього блоку (push/pull хмари, backup) портується разом із
          відповідними інфраструктурними кроками — див. примітки у кожній
          під-групі вище.
        </Text>
      </View>
    </SettingsGroup>
  );
}
