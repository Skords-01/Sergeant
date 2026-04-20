/**
 * Sergeant Hub-core — HubSettingsPage shell (React Native, first cut)
 *
 * Mobile port of `apps/web/src/core/HubSettingsPage.tsx`.
 *
 * Scope of this first cut (Phase 2 / Hub-core):
 *  - Shell with a screen title ("Налаштування") and a vertical stack of
 *    collapsible `SettingsGroup` cards, one per section.
 *  - Three sections ported: `GeneralSection`, `RoutineSection`,
 *    `ExperimentalSection`.
 *  - Four remaining sections (Notifications / Finyk / Fizruk /
 *    AIDigest) are rendered as `<PlaceholderSection>` cards with a
 *    "Скоро — буде портовано" label + the same `emoji + title` shape as
 *    `SettingsGroup` so the visual hierarchy is already final.
 *
 * Intentional differences from the web shell:
 *  - No `Tabs` group switcher and no fuzzy search input yet — both would
 *    pull in a sizeable chunk of layout logic that is better added once
 *    all sections are ported. For now the UX is "scroll through a
 *    single list of groups", which is the common mobile settings
 *    pattern (iOS/Android system settings, Linear, Things, etc).
 *  - `GeneralSection` on mobile is self-contained (reads prefs from MMKV
 *    under the shared `hub_prefs_v1` slice); web wires `dark` /
 *    `onToggleDark` / `syncing` / `onSync` / `onPull` / `user` via
 *    prop-drilling from the App root. The mobile equivalent for the
 *    cloud-sync buttons lands in a follow-up (see GeneralSection.tsx
 *    header for the rationale).
 */

import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";

import { ExperimentalSection } from "./ExperimentalSection";
import { GeneralSection } from "./GeneralSection";
import { RoutineSection } from "./RoutineSection";

interface PlaceholderSectionProps {
  title: string;
  emoji: string;
}

/**
 * Visual twin of `SettingsGroup` (collapsed state) for sections that
 * have not been ported yet. See the Phase 2 roadmap in
 * `docs/react-native-migration.md`.
 */
function PlaceholderSection({ title, emoji }: PlaceholderSectionProps) {
  return (
    <Card radius="lg" padding="md">
      <View className="flex-row items-center gap-2">
        <Text className="text-base">{emoji}</Text>
        <Text className="text-sm font-semibold text-stone-900 flex-1">
          {title}
        </Text>
        <Text className="text-xs text-stone-500">Скоро</Text>
      </View>
      <Text className="text-xs text-stone-500 mt-1 leading-snug">
        Буде портовано у наступному PR.
      </Text>
    </Card>
  );
}

export function HubSettingsPage() {
  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-[22px] font-bold text-stone-900 mb-1">
          Налаштування
        </Text>

        <GeneralSection />
        <RoutineSection />
        <ExperimentalSection />

        {/* TODO(mobile-migration): порт секцій іде окремими PR-ами.
            Див. docs/react-native-migration.md (Phase 2 / Hub-core). */}
        <PlaceholderSection title="Нагадування" emoji="🔔" />
        <PlaceholderSection title="AI-дайджести" emoji="🤖" />
        <PlaceholderSection title="Фізрук" emoji="🏋️" />
        <PlaceholderSection title="Фінік" emoji="💰" />
      </ScrollView>
    </SafeAreaView>
  );
}

export default HubSettingsPage;
