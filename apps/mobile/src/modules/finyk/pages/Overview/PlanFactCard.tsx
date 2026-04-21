/**
 * PlanFactCard — plan vs fact (income / expense / savings) for the
 * current month. Mobile port of
 * `apps/web/src/modules/finyk/pages/overview/PlanFactCard.tsx`.
 *
 * Returns `null` when the user hasn't configured a plan — matches web.
 */
import { memo } from "react";
import { Text, View } from "react-native";

import { Card } from "../../../../components/ui/Card";
import { cn } from "./cn";

export interface PlanFactCardProps {
  planIncome: number;
  planExpense: number;
  planSavings: number;
  income: number;
  spent: number;
  factSavings: number;
}

function fmt(n: number): string {
  return n.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}

const PlanFactCardImpl = function PlanFactCard({
  planIncome,
  planExpense,
  planSavings,
  income,
  spent,
  factSavings,
}: PlanFactCardProps) {
  if (!(planIncome > 0 || planExpense > 0 || planSavings > 0)) return null;

  return (
    <Card radius="lg" padding="lg">
      <Text className="text-xs font-medium text-stone-500 mb-3">
        План / Факт
      </Text>
      <View className="flex-row gap-4">
        <View className="flex-1">
          <Text className="text-xs text-stone-400 mb-1">План</Text>
          <Text className="text-sm text-stone-500 mt-1.5">
            +{fmt(planIncome)} ₴
          </Text>
          <Text className="text-sm text-stone-500 mt-1.5">
            −{fmt(planExpense)} ₴
          </Text>
          <Text className="text-sm text-stone-500 mt-1.5">
            {fmt(planSavings)} ₴ збер.
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-stone-400 mb-1">Факт</Text>
          <Text className="text-sm text-emerald-600 mt-1.5">
            +{fmt(income)} ₴
          </Text>
          <Text className="text-sm text-rose-600 mt-1.5">−{fmt(spent)} ₴</Text>
          <Text
            className={cn(
              "text-sm mt-1.5",
              factSavings >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {fmt(factSavings)} ₴ збер.
          </Text>
        </View>
      </View>
    </Card>
  );
};

export const PlanFactCard = memo(PlanFactCardImpl);
