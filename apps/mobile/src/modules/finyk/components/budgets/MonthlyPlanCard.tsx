import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { MonthlyPlanInput } from "@/modules/finyk/lib/budgetsStore";

export interface MonthlyPlanCardProps {
  monthlyPlan: MonthlyPlanInput;
  totalExpenseFact: number;
  remaining: number;
  pctExpense: number;
  isOver: boolean;
  safePerDay: number;
  daysLeft: number;
  onEdit: () => void;
  testID?: string;
}

function fmt(uah: number): string {
  return uah.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}

function MonthlyPlanCardImpl({
  monthlyPlan,
  totalExpenseFact,
  remaining,
  pctExpense,
  isOver,
  safePerDay,
  daysLeft,
  onEdit,
  testID,
}: MonthlyPlanCardProps) {
  const planIncome = Number(monthlyPlan?.income || 0);
  const planExpense = Number(monthlyPlan?.expense || 0);
  const hasPlan = planIncome > 0 || planExpense > 0;
  const overBy = totalExpenseFact - planExpense;

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel="Редагувати місячний план"
      testID={testID}
      className={
        isOver
          ? "rounded-2xl border border-danger/40 bg-cream-50 px-5 py-4"
          : "rounded-2xl border border-cream-300 bg-cream-50 px-5 py-4"
      }
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-stone-900">
          Фінплан на місяць
        </Text>
        <Text className="text-xs text-stone-500">✏️</Text>
      </View>

      {hasPlan ? (
        <>
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1 items-center">
              <Text className="text-[11px] text-stone-500 mb-0.5">
                Дохід (план)
              </Text>
              <Text
                className="text-sm font-semibold text-stone-900"
                testID={testID ? `${testID}-income` : undefined}
              >
                {planIncome > 0 ? `${fmt(planIncome)} ₴` : "—"}
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-[11px] text-stone-500 mb-0.5">
                Витрати (факт)
              </Text>
              <Text
                className={
                  isOver
                    ? "text-sm font-semibold text-danger"
                    : "text-sm font-semibold text-stone-900"
                }
                testID={testID ? `${testID}-fact` : undefined}
              >
                {fmt(totalExpenseFact)} ₴
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-[11px] text-stone-500 mb-0.5">Залишок</Text>
              <Text
                className={
                  isOver
                    ? "text-sm font-semibold text-danger"
                    : "text-sm font-semibold text-emerald-600"
                }
                testID={testID ? `${testID}-remaining` : undefined}
              >
                {isOver ? `−${fmt(overBy)} ₴` : `${fmt(remaining)} ₴`}
              </Text>
            </View>
          </View>

          {planExpense > 0 ? (
            <>
              <View className="flex-row justify-between mb-1">
                <Text className="text-[11px] text-stone-500">
                  {pctExpense}% від плану
                </Text>
                <Text className="text-[11px] text-stone-500">
                  план {fmt(planExpense)} ₴
                </Text>
              </View>
              <View className="h-2 bg-cream-200 rounded-full overflow-hidden">
                <View
                  testID={testID ? `${testID}-progress` : undefined}
                  style={{ width: `${pctExpense}%` }}
                  className={
                    isOver
                      ? "h-full bg-danger"
                      : pctExpense >= 85
                        ? "h-full bg-amber-500"
                        : "h-full bg-emerald-500"
                  }
                />
              </View>
            </>
          ) : null}

          {safePerDay > 0 && daysLeft > 0 && planExpense > 0 ? (
            <View
              className={
                isOver
                  ? "mt-3 rounded-xl bg-danger/10 px-3 py-2"
                  : pctExpense >= 85
                    ? "mt-3 rounded-xl bg-amber-100 px-3 py-2"
                    : "mt-3 rounded-xl bg-emerald-100 px-3 py-2"
              }
            >
              <Text
                className={
                  isOver
                    ? "text-sm text-danger"
                    : pctExpense >= 85
                      ? "text-sm text-amber-800"
                      : "text-sm text-emerald-800"
                }
              >
                <Text className="font-semibold">{fmt(safePerDay)} ₴/день</Text>
                <Text className="text-xs"> · безпечно ({daysLeft} дн.)</Text>
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text className="text-sm text-stone-500">
          Постав план — і побачиш скільки безпечно витрачати на день.
        </Text>
      )}
    </Pressable>
  );
}

export const MonthlyPlanCard = memo(MonthlyPlanCardImpl);
