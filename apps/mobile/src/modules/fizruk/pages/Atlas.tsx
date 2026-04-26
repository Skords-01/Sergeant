/**
 * Fizruk / Atlas page (mobile) — Phase 6 · PR-C wiring.
 *
 * The heavy lifting lives in `../components/BodyAtlas.tsx`; this page
 * just renders a hero + `Card` + `BodyAtlas` on the existing route
 * scaffold (PR #450). The full recovery-driven wiring
 * (`useRecovery` → `statusByMuscle`) lands in the later Fizruk PR that
 * ports the recovery hook; until then the page shows the baseline
 * silhouette with a small placeholder highlight so reviewers can see
 * the interactive states without pulling unrelated hooks into this PR.
 */

import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";

import { BodyAtlas, type ActiveMuscle } from "../components/BodyAtlas";
import {
  BODY_ATLAS_MUSCLE_LABELS_UK,
  type BodyAtlasMuscleId,
} from "@sergeant/fizruk-domain/data/bodyAtlas";

// Demo payload until `useRecovery()` is ported. Values loosely mirror
// the mid-level `yellow` / high-level `red` recovery statuses the web
// Atlas produces for a user with recent chest + quad sessions.
const DEMO_MUSCLES: readonly ActiveMuscle[] = [
  { id: "chest", intensity: 0.8 },
  { id: "quadriceps", intensity: 1 },
  { id: "biceps", intensity: 0.6 },
];

export function Atlas() {
  const [selected, setSelected] = useState<BodyAtlasMuscleId | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      >
        <View>
          <Text className="text-[22px] font-bold text-fg">
            {"Атлас м'язів"}
          </Text>
          <Text className="text-sm text-fg-muted leading-snug">
            {
              "Інтерактивна карта груп м'язів. Тапни зону — отримаєш назву, інтенсивність навантаження та можливість перейти до вправ у наступних PR."
            }
          </Text>
        </View>

        <Card radius="lg" padding="md">
          <BodyAtlas
            muscles={DEMO_MUSCLES}
            onMusclePress={(id) => setSelected(id)}
            height={420}
          />
          <View className="mt-2 items-center">
            <Text className="text-xs text-fg-muted">
              {selected
                ? `Обрано: ${BODY_ATLAS_MUSCLE_LABELS_UK[selected]}`
                : "Натисни на м'яз, щоб побачити деталі."}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Atlas;
