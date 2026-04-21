/**
 * HeroCard — top gradient-like hero with networth, this-month balance and
 * cards/debt breakdown. Mobile port of
 * `apps/web/src/modules/finyk/pages/overview/HeroCard.tsx`.
 *
 * Parity notes:
 * - Uses a flat emerald surface instead of a CSS gradient (RN has no
 *   `bg-gradient-to-br` support out of the box). The gradient is
 *   approximated by stacking a `bg-emerald-700` container on top of a
 *   `bg-emerald-900` border — visually close, zero native deps.
 * - Balance masking (`showBalance=false`) replaces the amount with
 *   bullet characters just like on web.
 */
import { memo } from "react";
import { Text, View } from "react-native";

import { cn } from "./cn";

export interface HeroCardProps {
  networth: number;
  monoTotal: number;
  totalDebt: number;
  monthBalance: number;
  firstName: string;
  dateLabel: string;
  showBalance?: boolean;
}

function format(value: number): string {
  return value.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}

const HeroCardImpl = function HeroCard({
  networth,
  monoTotal,
  totalDebt,
  monthBalance,
  firstName,
  dateLabel,
  showBalance = true,
}: HeroCardProps) {
  return (
    <View
      className="rounded-3xl bg-emerald-700 border border-emerald-900 p-5"
      testID="finyk-overview-hero"
    >
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-emerald-50 text-sm">Загальний нетворс</Text>
          <Text className="text-xs text-emerald-200 mt-0.5 capitalize">
            {firstName} · {dateLabel}
          </Text>
        </View>
      </View>
      <Text
        className={cn(
          "text-white font-bold mt-2",
          showBalance ? "text-4xl" : "text-3xl tracking-widest",
        )}
      >
        {showBalance ? `${format(networth)} ₴` : "••••••"}
      </Text>

      <View className="mt-4 pt-4 border-t border-emerald-900/40 flex-row justify-between">
        <View>
          <Text className="text-emerald-200 text-xs">Картки</Text>
          <Text className="text-white font-semibold mt-1">
            {showBalance ? `${format(monoTotal)} ₴` : "••••"}
          </Text>
        </View>
        <View>
          <Text className="text-emerald-200 text-xs">Борги</Text>
          <Text className="text-white font-semibold mt-1">
            {showBalance ? `${format(totalDebt)} ₴` : "••••"}
          </Text>
        </View>
        <View>
          <Text className="text-emerald-200 text-xs">Місяць</Text>
          <Text
            className={cn(
              "font-semibold mt-1",
              monthBalance >= 0 ? "text-emerald-200" : "text-rose-300",
            )}
          >
            {showBalance
              ? `${monthBalance >= 0 ? "+" : "−"}${format(Math.abs(monthBalance))} ₴`
              : "••••"}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const HeroCard = memo(HeroCardImpl);
