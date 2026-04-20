/**
 * Shared placeholder-page component for the Fizruk RN scaffold.
 *
 * Every Fizruk page gets its own route file and its own page component
 * so subsequent PRs can fill them in individually without touching the
 * shell. Until those PRs land, pages render this component — a single
 * `Card` with the page title, a description of what is coming, and a
 * bulleted feature list (same shape as `apps/mobile/src/components/
 * ModuleStub.tsx`, but card-styled to match Phase 2 / `HubSettingsPage`).
 *
 * Keeping the placeholder in a dedicated module — instead of repeating
 * the markup across nine page files — makes the shell PR a small,
 * reviewable diff and guarantees consistent visuals while ports land.
 */

import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";

export interface PagePlaceholderProps {
  title: string;
  description: string;
  plannedFeatures: readonly string[];
  /**
   * Short hint pointing at the PR phase where this page will be ported.
   * Shown as a muted caption so reviewers can orient themselves fast.
   */
  phaseHint?: string;
}

export function PagePlaceholder({
  title,
  description,
  plannedFeatures,
  phaseHint,
}: PagePlaceholderProps) {
  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-[22px] font-bold text-stone-900">{title}</Text>
        <Text className="text-sm text-stone-600 leading-snug">
          {description}
        </Text>

        <Card radius="lg" padding="md">
          <View className="gap-2">
            <Text className="text-sm font-semibold text-stone-900">
              Заплановано до порту
            </Text>
            <View className="gap-1.5">
              {plannedFeatures.map((item) => (
                <View key={item} className="flex-row gap-2">
                  <Text className="text-teal-600">•</Text>
                  <Text className="text-sm text-stone-700 flex-1 leading-snug">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            {phaseHint ? (
              <Text className="text-xs text-stone-500 mt-1">{phaseHint}</Text>
            ) : null}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
