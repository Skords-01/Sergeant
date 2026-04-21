import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { Budget } from "@sergeant/finyk-domain/domain";

export interface GoalBudgetRowProps {
  budget: Budget & {
    name?: string;
    emoji?: string;
    targetAmount?: number;
    savedAmount?: number;
  };
  saved: number;
  pct: number;
  daysLeft: number | null;
  monthlyLabel: string | null;
  onEdit: () => void;
  testID?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}

function GoalBudgetRowImpl({
  budget,
  saved,
  pct,
  daysLeft,
  monthlyLabel,
  onEdit,
  testID,
}: GoalBudgetRowProps) {
  const barWidth = `${Math.min(100, Math.max(0, pct))}%` as const;
  const target = Number(budget.targetAmount) || 0;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`Редагувати ціль ${budget.name || ""}`}
      testID={testID}
      className="rounded-2xl border border-cream-300 bg-white px-4 py-3"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold text-stone-900 flex-1" numberOfLines={1}>
          {budget.emoji ? `${budget.emoji} ` : ""}
          {budget.name || "—"}
        </Text>
        <Text
          className="text-xs text-stone-500"
          testID={testID ? `${testID}-amount` : undefined}
        >
          {fmt(saved)} / {fmt(target)} ₴
        </Text>
      </View>
      <View className="h-2 bg-cream-200 rounded-full overflow-hidden">
        <View
          style={{ width: barWidth }}
          className="h-full bg-emerald-500"
        />
      </View>
      {monthlyLabel ? (
        <Text className="text-xs text-stone-500 mt-1.5">{monthlyLabel}</Text>
      ) : null}
      <Text className="text-xs text-stone-500 mt-0.5">
        {pct}% ·{" "}
        {daysLeft !== null
          ? daysLeft > 0
            ? `${daysLeft} днів до мети`
            : "⏰ Термін минув"
          : "Без дедлайну"}
      </Text>
    </Pressable>
  );
}

export const GoalBudgetRow = memo(GoalBudgetRowImpl);
