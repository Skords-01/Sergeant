/**
 * Sergeant Hub-core — HubSettingsPage shell (React Native, first cut)
 *
 * Mobile port of `apps/web/src/core/hub/HubSettingsPage.tsx`.
 *
 * Scope of this cut (Phase 2 / Hub-core — remaining sections PR):
 *  - Shell with a screen title ("Налаштування") and a vertical stack of
 *    collapsible `SettingsGroup` cards, one per section.
 *  - All eight Hub-core sections now porting in: `GeneralSection`,
 *    `NotificationsSection`, `RoutineSection`, `FinykSection`,
 *    `FizrukSection`, `AIDigestSection`, `AssistantCatalogueSection`,
 *    `ExperimentalSection`. The catalogue section is a thin launcher
 *    for the `/assistant` modal route — see `app/assistant.tsx`.
 *
 * Intentional differences from the web shell:
 *  - No `Tabs` group switcher and no fuzzy search input yet — both
 *    would pull in a sizeable chunk of layout logic that is better
 *    added once every section is polished. For now the UX is
 *    "scroll through a single list of groups", which is the common
 *    mobile-settings pattern (iOS/Android system settings, Linear,
 *    Things, etc).
 *  - `GeneralSection` on mobile is self-contained (reads prefs from
 *    MMKV under the shared `hub_prefs_v1` slice); web wires `dark` /
 *    `onToggleDark` / `syncing` / `onSync` / `onPull` / `user` via
 *    prop-drilling from the App root. The mobile equivalent for the
 *    cloud-sync buttons lands in a follow-up (see GeneralSection.tsx
 *    header for the rationale).
 */

import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountSection } from "./AccountSection";
import { AIDigestSection } from "./AIDigestSection";
import { AssistantCatalogueSection } from "./AssistantCatalogueSection";
import { ExperimentalSection } from "./ExperimentalSection";
import { FinykSection } from "./FinykSection";
import { FizrukSection } from "./FizrukSection";
import { GeneralSection } from "./GeneralSection";
import { NotificationsSection } from "./NotificationsSection";
import { RoutineSection } from "./RoutineSection";

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
        <NotificationsSection />
        <RoutineSection />
        <FinykSection />
        <FizrukSection />
        <AIDigestSection />
        <AssistantCatalogueSection />
        <ExperimentalSection />
        <AccountSection />
      </ScrollView>
    </SafeAreaView>
  );
}

export default HubSettingsPage;
