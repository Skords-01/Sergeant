import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { Subscription } from "@/modules/finyk/lib/budgetsStore";

export interface SubscriptionRowProps {
  subscription: Subscription;
  /** Days until the next billing day. Negative = already passed this month. */
  daysToNext: number | null;
  amountLabel: string | null;
  onPress: () => void;
  testID?: string;
}

function SubscriptionRowImpl({
  subscription,
  daysToNext,
  amountLabel,
  onPress,
  testID,
}: SubscriptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Редагувати ${subscription.name}`}
      testID={testID}
      className="flex-row items-center px-3 py-3 border-b border-cream-200"
    >
      <Text className="text-xl mr-3">{subscription.emoji || "📦"}</Text>
      <View className="flex-1 min-w-0">
        <Text
          className="text-sm font-semibold text-stone-900"
          numberOfLines={1}
        >
          {subscription.name}
        </Text>
        <Text className="text-xs text-stone-500" numberOfLines={1}>
          {amountLabel ?? `${subscription.currency || "UAH"}`} · день{" "}
          {subscription.billingDay}
        </Text>
      </View>
      {daysToNext !== null ? (
        <View
          className={
            daysToNext <= 3
              ? "rounded-full bg-amber-100 px-2 py-0.5"
              : "rounded-full bg-cream-100 px-2 py-0.5"
          }
        >
          <Text
            className={
              daysToNext <= 3
                ? "text-[11px] font-medium text-amber-800"
                : "text-[11px] font-medium text-stone-600"
            }
          >
            {daysToNext === 0
              ? "сьогодні"
              : daysToNext > 0
                ? `за ${daysToNext} дн.`
                : `${-daysToNext} дн. тому`}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const SubscriptionRow = memo(SubscriptionRowImpl);
