import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { Budget } from "@sergeant/finyk-domain/domain";

export interface LimitBudgetRowProps {
  budget: Budget;
  categoryLabel: string;
  spent: number;
  pctRaw: number;
  pctRounded: number;
  remaining: number;
  overLimit: boolean;
  warnLimit: boolean;
  onEdit: () => void;
  testID?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}

function LimitBudgetRowImpl({
  budget,
  categoryLabel,
  spent,
  pctRaw,
  pctRounded,
  remaining,
  overLimit,
  warnLimit,
  onEdit,
  testID,
}: LimitBudgetRowProps) {
  const barWidth = `${Math.min(100, Math.max(0, pctRaw))}%` as const;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`Редагувати ліміт ${categoryLabel}`}
      testID={testID}
      className="rounded-2xl border border-cream-300 bg-white px-4 py-3"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold text-stone-900 flex-1" numberOfLines={1}>
          {categoryLabel || "—"}
        </Text>
        <Text
          className={
            overLimit
              ? "text-xs font-semibold text-danger"
              : warnLimit
                ? "text-xs text-amber-600"
                : "text-xs text-stone-500"
          }
          testID={testID ? `${testID}-amount` : undefined}
        >
          {fmt(spent)} / {fmt(Number(budget.limit) || 0)} ₴
        </Text>
      </View>
      <View className="h-2 bg-cream-200 rounded-full overflow-hidden">
        <View
          style={{ width: barWidth }}
          className={
            overLimit
              ? "h-full bg-danger"
              : warnLimit
                ? "h-full bg-amber-500"
                : "h-full bg-emerald-500"
          }
        />
      </View>
      <Text
        className={
          overLimit
            ? "text-xs text-danger mt-2"
            : warnLimit
              ? "text-xs text-amber-700 mt-2"
              : "text-xs text-stone-500 mt-2"
        }
        testID={testID ? `${testID}-status` : undefined}
      >
        {overLimit
          ? `Перевищено на ${fmt(spent - (Number(budget.limit) || 0))} ₴`
          : `Залишок ${fmt(remaining)} ₴ · ${pctRounded}%`}
      </Text>
    </Pressable>
  );
}

export const LimitBudgetRow = memo(LimitBudgetRowImpl);
