/**
 * Sergeant Nutrition — NutritionBottomNav (React Native)
 *
 * Three-tab segmented control для модуля Харчування (mobile). Патерн
 * 1:1 з `RoutineBottomNav` — інлайн buttons з емодзі, 44×44 min tap
 * targets, a11y tablist/tab roles.
 *
 * Phase 7 / PR 4 рендерить лише 3 вкладки — Dashboard / Log / Water.
 * AddMeal, Pantry, Shopping list, Recipes — це наступні PR-и, і вони
 * приєднаються сюди як нові пункти (або як sub-tabs всередині Log).
 */
import { Pressable, Text, View } from "react-native";

import { hapticTap } from "@sergeant/shared";

export type NutritionMainTab = "dashboard" | "log" | "water";

interface NavItem {
  id: NutritionMainTab;
  label: string;
  emoji: string;
}

const NAV: readonly NavItem[] = [
  { id: "dashboard", label: "Сьогодні", emoji: "🍽️" },
  { id: "log", label: "Журнал", emoji: "📒" },
  { id: "water", label: "Вода", emoji: "💧" },
];

export interface NutritionBottomNavProps {
  mainTab: NutritionMainTab;
  onSelectTab: (tab: NutritionMainTab) => void;
  testID?: string;
}

export function NutritionBottomNav({
  mainTab,
  onSelectTab,
  testID,
}: NutritionBottomNavProps) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Розділи Харчування"
      testID={testID}
      className="flex-row items-stretch border-t border-cream-300 bg-cream-50"
    >
      {NAV.map((item) => {
        const selected = item.id === mainTab;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            testID={testID ? `${testID}-${item.id}` : undefined}
            onPress={() => {
              if (selected) return;
              hapticTap();
              onSelectTab(item.id);
            }}
            className="flex-1 items-center justify-center py-2 min-h-[56px]"
          >
            <Text
              className={`text-xl ${selected ? "opacity-100" : "opacity-60"}`}
            >
              {item.emoji}
            </Text>
            <Text
              className={`text-[11px] mt-0.5 ${
                selected ? "text-coral-700 font-semibold" : "text-stone-500"
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
