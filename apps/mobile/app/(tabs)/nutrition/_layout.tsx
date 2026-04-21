/**
 * Nutrition tab — nested Stack layout.
 *
 * Provides parent routes for deep-link targets:
 *   - `sergeant://food/log`           → `index`   (current `ModuleStub`)
 *   - `sergeant://food/scan`          → `scan`
 *   - `sergeant://food/recipe/{id}`   → `recipe/[id]`
 *
 * Real screens land in Phase 7 of the migration; today every leaf
 * renders `DeepLinkPlaceholder` so shortcuts and push-deep-links
 * never dead-end.
 */
import { Stack, useRouter } from "expo-router";

import ModuleErrorBoundary from "@/core/ModuleErrorBoundary";
import { colors } from "@/theme";

export default function NutritionStackLayout() {
  const router = useRouter();
  return (
    <ModuleErrorBoundary
      moduleName="Харчування"
      onBackToHub={() => {
        router.replace("/");
      }}
    >
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.accent,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: "Сканер" }} />
        <Stack.Screen name="recipe/[id]" options={{ title: "Рецепт" }} />
      </Stack>
    </ModuleErrorBoundary>
  );
}
