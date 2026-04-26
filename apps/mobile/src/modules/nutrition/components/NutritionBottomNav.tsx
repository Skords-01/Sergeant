/**
 * Sergeant Nutrition — NutritionBottomNav (React Native)
 *
 * Three-tab segmented control для модуля Харчування (mobile). Патерн
 * 1:1 з `RoutineBottomNav` — інлайн buttons з емодзі, 44×44 min tap
 * targets, a11y tablist/tab roles.
 *
 * Вкладки: Сьогодні / Журнал / Вода / Покупки. Pantry і рецепти — окремі
 * екрани / PR-и.
 */
import { Pressable, Text, View } from "react-native";

import { hapticTap } from "@sergeant/shared";

export type NutritionMainTab = "dashboard" | "log" | "water" | "shopping";

interface NavItem {
  id: NutritionMainTab;
  label: string;
  emoji: string;
}

const NAV: readonly NavItem[] = [
  { id: "dashboard", label: "Сьогодні", emoji: "🍽️" },
  { id: "log", label: "Журнал", emoji: "📒" },
  { id: "water", label: "Вода", emoji: "💧" },
  { id: "shopping", label: "Покупки", emoji: "🛒" },
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
                selected ? "text-coral-700 font-semibold" : "text-fg-muted"
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
