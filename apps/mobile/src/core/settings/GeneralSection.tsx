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
 * Deferred (tracked in `docs/react-native-migration.md` Phase 2 /
 * Hub-core, section 2.4):
 *  - **Dashboard reorder list.** Depends on `HubDashboard` which is
 *    not yet ported. Rendered here as a short `Card` notice
 *    ("Перенесення доступне після порту Dashboard") so the sub-group
 *    layout stays in place and lands automatically once the mobile
 *    dashboard ships.
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
 * Dark-mode wiring caveat:
 *  - Mobile has no semantic dark-mode tokens yet (see `Card.tsx`
 *    and `Button.tsx` TODOs). This section persists the user's
 *    preference so the cloud-sync payload is already in the right
 *    shape; actually re-tinting surfaces lands once `nativewind`'s
 *    `colorScheme` is wired through the app root.
 */

import { Text, View } from "react-native";
import { STORAGE_KEYS } from "@sergeant/shared";

import { Card } from "@/components/ui/Card";
import { useLocalStorage } from "@/lib/storage";

import {
  SettingsGroup,
  SettingsSubGroup,
  ToggleRow,
} from "./SettingsPrimitives";

interface HubPrefs {
  showCoach?: boolean;
  darkMode?: boolean;
}

// Mirrors the web `hub_prefs_v1` key so cloud-synced prefs live in a
// single slice across platforms. See
// `apps/web/src/core/settings/hubPrefs.ts`.
const HUB_PREFS_KEY = STORAGE_KEYS.HUB_PREFS;

function DeferredNotice({ children }: { children: string }) {
  return (
    <Card variant="flat" radius="md" padding="md" className="border-dashed">
      <Text className="text-xs text-stone-500 leading-snug">{children}</Text>
    </Card>
  );
}

export function GeneralSection() {
  const [prefs, setPrefs] = useLocalStorage<HubPrefs>(HUB_PREFS_KEY, {});

  // Web mirrors `useHubPref("showCoach", true)` — default-on, so we
  // read `prefs.showCoach !== false` to preserve that behaviour when
  // the pref hasn't been touched yet.
  const showCoach = prefs.showCoach !== false;
  const dark = prefs.darkMode === true;

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
      </SettingsSubGroup>
      <SettingsSubGroup title="Упорядкувати модулі">
        <DeferredNotice>
          Перенесення доступне після порту Dashboard.
        </DeferredNotice>
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
      {/* Module-reorder-list state lives on web via `loadDashboardOrder`
          from HubDashboard.jsx. Ми навмисно не порт-імо його тут, щоб
          не прив'язати mobile GeneralSection до ще не портованого
          dashboard store. Повернемось сюди у PR з HubDashboard. */}
      <View className="gap-1">
        <Text className="text-[11px] text-stone-400 leading-snug">
          Решта опцій цього блоку (push/pull хмари, backup, порядок модулів)
          портується разом із відповідними інфраструктурними кроками — див.
          примітки у кожній під-групі вище.
        </Text>
      </View>
    </SettingsGroup>
  );
}
