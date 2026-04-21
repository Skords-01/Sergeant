/**
 * Two shortcut buttons shown under the Hero card: "Операції" / "Бюджети".
 *
 * Mobile port of `apps/web/src/modules/finyk/pages/overview/NavButtons.tsx`.
 * The web version dispatches through an `onNavigate(route)` callback; on
 * mobile we hand off to `expo-router` directly so parents do not have to
 * pipe routing state through the hierarchy.
 */
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

export interface NavButtonsProps {
  onNavigate?: (route: "transactions" | "budgets") => void;
}

const NavButtonsImpl = function NavButtons({ onNavigate }: NavButtonsProps) {
  return (
    <View className="flex-row gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Операції"
        onPress={() => onNavigate?.("transactions")}
        className="flex-1 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 active:opacity-80"
      >
        <Text className="text-sm font-medium text-stone-900">Операції →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Бюджети"
        onPress={() => onNavigate?.("budgets")}
        className="flex-1 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 active:opacity-80"
      >
        <Text className="text-sm font-medium text-stone-900">Бюджети →</Text>
      </Pressable>
    </View>
  );
};

export const NavButtons = memo(NavButtonsImpl);
