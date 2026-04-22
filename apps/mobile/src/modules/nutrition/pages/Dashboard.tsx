/**
 * Nutrition Dashboard (Сьогодні) — mobile
 * Mirror `apps/web/src/modules/nutrition/components/NutritionDashboard.tsx`
 *
 * PR-4 рендерить:
 *  - "Сьогодні" Card: лічильник прийомів + 4 macro-ring / 4 macro-tile
 *  - "Тиждень · ккал" Card: 7-денна mini-bar-chart
 *  - WaterTrackerCard
 *
 * Не входить у PR-4 (відкладено):
 *  - Кнопка "+ Додати" (веде в AddMealSheet → PR-5)
 *  - Кнопка "Налаштувати денні цілі КБЖВ" (settings screen → PR-7)
 *  - AI-підказка дня (PR-8)
 */
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  getDayMacros,
  getDaySummary,
  getMacrosForDateRange,
  type NutritionPrefs,
} from "@sergeant/nutrition-domain";
import { toLocalISODate, type Macros } from "@sergeant/shared";

import { Card } from "@/components/ui/Card";

import { MacroRing } from "../components/MacroRing";
import { WaterTrackerCard } from "../components/WaterTrackerCard";
import { WeekKcalChart } from "../components/WeekKcalChart";
import { useNutritionLog } from "../hooks/useNutritionLog";
import { useNutritionPrefs } from "../hooks/useNutritionPrefs";

type MacroKey = "kcal" | "protein_g" | "fat_g" | "carbs_g";

interface MacroDef {
  key: MacroKey;
  label: string;
  color: string;
  prefKey: keyof NutritionPrefs;
  unit: string;
}

const MACRO_DEFS: readonly MacroDef[] = [
  {
    key: "kcal",
    label: "Ккал",
    color: "#f97316",
    prefKey: "dailyTargetKcal",
    unit: "",
  },
  {
    key: "protein_g",
    label: "Білки",
    color: "#3b82f6",
    prefKey: "dailyTargetProtein_g",
    unit: "г",
  },
  {
    key: "fat_g",
    label: "Жири",
    color: "#eab308",
    prefKey: "dailyTargetFat_g",
    unit: "г",
  },
  {
    key: "carbs_g",
    label: "Вуглев.",
    color: "#22c55e",
    prefKey: "dailyTargetCarbs_g",
    unit: "г",
  },
] as const;

function mealCountLabel(count: number): string {
  if (count === 1) return "прийом";
  if (count >= 2 && count <= 4) return "прийоми";
  return "прийомів";
}

export interface DashboardProps {
  testID?: string;
}

export function Dashboard({ testID }: DashboardProps) {
  const { nutritionLog } = useNutritionLog();
  const { prefs } = useNutritionPrefs();

  const today = toLocalISODate(new Date());

  const macros: Macros = useMemo(
    () => getDayMacros(nutritionLog, today),
    [nutritionLog, today],
  );
  const summary = useMemo(
    () => getDaySummary(nutritionLog, today),
    [nutritionLog, today],
  );
  const weekRows = useMemo(
    () => getMacrosForDateRange(nutritionLog, today, 7),
    [nutritionLog, today],
  );

  const hasTargets =
    (prefs.dailyTargetKcal || 0) > 0 ||
    (prefs.dailyTargetProtein_g || 0) > 0 ||
    (prefs.dailyTargetFat_g || 0) > 0 ||
    (prefs.dailyTargetCarbs_g || 0) > 0;

  return (
    <ScrollView
      testID={testID}
      className="flex-1 bg-cream-50"
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Card testID="nutrition-today-card">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-sm font-semibold text-stone-900 leading-none">
              Сьогодні
            </Text>
            <Text className="text-xs text-stone-500 mt-1">
              {summary.mealCount} {mealCountLabel(summary.mealCount)} їжі
            </Text>
          </View>
        </View>

        {hasTargets ? (
          <View className="flex-row justify-around">
            {MACRO_DEFS.map((m) => (
              <MacroRing
                key={m.key}
                value={macros[m.key] || 0}
                target={Number(prefs[m.prefKey]) || 0}
                color={m.color}
                label={m.label}
                unit={m.unit}
              />
            ))}
          </View>
        ) : (
          <View className="flex-row gap-2">
            {MACRO_DEFS.map((m) => (
              <View
                key={m.key}
                className="flex-1 rounded-xl border border-lime-500/20 bg-lime-500/10 px-2 py-2.5 items-center"
              >
                <Text className="text-[10px] font-bold uppercase text-lime-700 leading-none mb-1">
                  {m.label}
                </Text>
                <Text className="text-sm font-extrabold text-stone-900 leading-none">
                  {Math.round(macros[m.key] || 0)}
                  {m.unit ? ` ${m.unit}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card testID="nutrition-week-card">
        <Text className="text-sm font-semibold text-stone-900 mb-2 leading-none">
          Тиждень · ккал
        </Text>
        <WeekKcalChart
          rows={weekRows}
          targetKcal={prefs.dailyTargetKcal || 0}
          todayIso={today}
        />
      </Card>

      <WaterTrackerCard
        goalMl={prefs.waterGoalMl ?? 2000}
        testID="nutrition-water-card"
      />
    </ScrollView>
  );
}
