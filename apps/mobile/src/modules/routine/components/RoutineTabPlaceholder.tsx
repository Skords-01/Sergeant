/**
 * Sergeant Routine — RoutineTabPlaceholder (React Native)
 *
 * Visual twin of `PlaceholderSection` from HubSettingsPage — a single
 * branded card with an emoji + title + "Скоро — буде портовано" body.
 *
 * Used for the 3 Routine sub-tabs (Calendar / Stats / Settings) until
 * each is filled in by subsequent Phase 5 PRs. Centralising the
 * placeholder keeps the shell PR (PR 1) fully dependency-free and
 * guarantees all 3 stubs share identical visual hierarchy.
 */

import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";

interface RoutineTabPlaceholderProps {
  title: string;
  emoji: string;
  description: string;
  plannedFeatures: ReadonlyArray<string>;
}

export function RoutineTabPlaceholder({
  title,
  emoji,
  description,
  plannedFeatures,
}: RoutineTabPlaceholderProps) {
  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      >
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-[22px]">{emoji}</Text>
          <Text className="text-[22px] font-bold text-fg flex-1">{title}</Text>
        </View>
        <Text className="text-sm text-fg-muted mb-2 leading-snug">
          {description}
        </Text>

        <Card radius="lg" padding="md">
          <Text className="text-sm font-semibold text-fg mb-2">
            Заплановано до порту
          </Text>
          {plannedFeatures.map((item) => (
            <View key={item} className="flex-row mb-1.5">
              <Text className="text-coral-600 mr-2">•</Text>
              <Text className="text-sm text-fg flex-1 leading-snug">
                {item}
              </Text>
            </View>
          ))}
          <Text className="text-xs text-fg-muted mt-2 leading-snug">
            Скоро — буде портовано у наступному PR Фази 5.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
