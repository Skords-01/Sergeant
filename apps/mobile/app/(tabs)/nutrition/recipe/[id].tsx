/**
 * Deep-link target for `sergeant://food/recipe/{id}`.
 *
 * Stub until Phase 7 ports the web Recipe detail screen.
 */
import { useLocalSearchParams } from "expo-router";

import { DeepLinkPlaceholder } from "@/components/DeepLinkPlaceholder";

export default function NutritionRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DeepLinkPlaceholder
      title="Рецепт"
      detail={id ? `ID: ${id}` : undefined}
      followUp="Детальна карточка рецепта — Phase 7 (Порт модуля Харчування)."
      primaryAction={{ label: "До Харчування", href: "/(tabs)/nutrition" }}
    />
  );
}
