/**
 * Nutrition tab — nested Stack layout.
 * `index` — `NutritionApp`; `scan` — сканер штрихкодів (expo-camera);
 * `recipe/[id]` — поки заглушка.
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
