/**
 * Income / Expense pill pair shown directly under the Hero card.
 *
 * Mobile port of `apps/web/src/modules/finyk/pages/overview/IncomeExpensePills.tsx`.
 * Inline SVG arrows from the web version are swapped for simple emoji
 * glyphs to keep the component self-contained (no icon-system coupling).
 */
import { memo } from "react";
import { Text, View } from "react-native";

import { Card } from "../../../../components/ui/Card";

export interface IncomeExpensePillsProps {
  income: number;
  spent: number;
  showBalance?: boolean;
}

function format(value: number): string {
  return value.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}

const IncomeExpensePillsImpl = function IncomeExpensePills({
  income,
  spent,
  showBalance = true,
}: IncomeExpensePillsProps) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <Card radius="lg">
          <View className="flex-row items-center gap-2">
            <Text className="text-emerald-600 text-base">↗</Text>
            <Text className="text-xs text-stone-500">Дохід</Text>
          </View>
          <Text className="text-xl font-semibold mt-1 text-stone-900">
            {showBalance ? `+${format(income)}` : "••••"}{" "}
            <Text className="text-base font-medium text-stone-400">₴</Text>
          </Text>
        </Card>
      </View>
      <View className="flex-1">
        <Card radius="lg">
          <View className="flex-row items-center gap-2">
            <Text className="text-rose-600 text-base">↘</Text>
            <Text className="text-xs text-stone-500">Витрати</Text>
          </View>
          <Text className="text-xl font-semibold mt-1 text-stone-900">
            {showBalance ? `−${format(spent)}` : "••••"}{" "}
            <Text className="text-base font-medium text-stone-400">₴</Text>
          </Text>
        </Card>
      </View>
    </View>
  );
};

export const IncomeExpensePills = memo(IncomeExpensePillsImpl);
