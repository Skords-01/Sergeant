/**
 * QuickAddCard — top-categories + recent merchants launcher.
 *
 * Mobile port of `apps/web/src/modules/finyk/pages/overview/QuickAddCard.tsx`.
 * Re-uses the same `CANONICAL_TO_MANUAL_LABEL` lookup from the domain
 * package so label parity with web is guaranteed.
 */
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { CANONICAL_TO_MANUAL_LABEL } from "@sergeant/finyk-domain/domain";

import { Card } from "../../../../components/ui/Card";
import type { FrequentCategory, FrequentMerchant } from "./types";

export interface QuickAddCardProps {
  onQuickAdd?: (categoryLabel?: string | null) => void;
  frequentCategories?: FrequentCategory[];
  frequentMerchants?: FrequentMerchant[];
}

const QuickAddCardImpl = function QuickAddCard({
  onQuickAdd,
  frequentCategories = [],
  frequentMerchants = [],
}: QuickAddCardProps) {
  if (!onQuickAdd) return null;
  if (frequentCategories.length === 0 && frequentMerchants.length === 0)
    return null;

  return (
    <Card radius="lg" padding="lg">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-stone-900">
            Швидке додавання
          </Text>
          <Text className="text-sm text-stone-500 mt-0.5">
            Ваші найчастіші категорії
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Нова витрата"
          onPress={() => onQuickAdd()}
          className="px-1 py-2 active:opacity-60"
        >
          <Text className="text-xs font-semibold text-emerald-700">
            Нова витрата →
          </Text>
        </Pressable>
      </View>

      {frequentCategories.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {frequentCategories.slice(0, 5).map((c) => {
            const manualLabel =
              c.manualLabel || CANONICAL_TO_MANUAL_LABEL[c.id] || c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.label || manualLabel}
                onPress={() => onQuickAdd(manualLabel)}
                className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-cream-100 border border-cream-300 active:opacity-70"
              >
                <Text className="text-sm font-medium text-stone-900">
                  {c.label || manualLabel}
                </Text>
                <Text className="text-xs text-stone-500">×{c.count}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {frequentMerchants.length > 0 && (
        <View className="pt-3 mt-3 border-t border-cream-300">
          <Text className="text-sm font-semibold text-stone-900 mb-2">
            Нещодавнє
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {frequentMerchants.slice(0, 4).map((m) => (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                accessibilityLabel={m.name}
                onPress={() => onQuickAdd(m.suggestedManualCategory ?? null)}
                className="px-2.5 py-1 rounded-full bg-cream-100 border border-cream-300 active:opacity-70"
              >
                <Text className="text-xs font-medium text-stone-500">
                  {m.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
};

export const QuickAddCard = memo(QuickAddCardImpl);
