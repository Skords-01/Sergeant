/**
 * Sergeant Hub — WeeklyDigestCard (mobile placeholder).
 *
 * Minimal stub that stands in for the full web `WeeklyDigestCard`
 * while the mobile port is carved out across follow-up PRs. Today
 * this renders a modal-style sheet with the week label, the
 * digest's `generatedAt` timestamp (if any), and a close button.
 *
 * The full port will land in a later PR alongside the mobile
 * `useWeeklyDigest` mutation hook and the story viewer; keeping the
 * structural entry point in place here means `HubDashboard` +
 * `WeeklyDigestFooter` can wire their open / close flow without
 * blocking on that larger port.
 */

import { memo } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { getWeekKey } from "@sergeant/shared";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { loadDigest } from "./weeklyDigestStorage";

export interface WeeklyDigestCardProps {
  /**
   * Explicit week key (`YYYY-MM-DD` of that week's Monday). Defaults
   * to the current week so most callers can just pass `open` + the
   * close handler.
   */
  weekKey?: string;
  open: boolean;
  onClose: () => void;
  testID?: string;
}

export const WeeklyDigestCard = memo(function WeeklyDigestCard({
  weekKey,
  open,
  onClose,
  testID,
}: WeeklyDigestCardProps) {
  const resolvedWeekKey = weekKey ?? getWeekKey();
  const digest = open ? loadDigest(resolvedWeekKey) : null;
  const generatedAt = digest?.generatedAt ? new Date(digest.generatedAt) : null;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID={testID ?? "weekly-digest-card"}
    >
      <View className="flex-1 bg-stone-900/40 px-4 justify-end">
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          className="absolute inset-0"
        />
        <Card className="mb-6 rounded-3xl bg-cream-50 p-5">
          <ScrollView>
            <View className="gap-2">
              <Text className="text-sm font-semibold uppercase text-stone-500">
                Тижневий дайджест
              </Text>
              <Text className="text-xl font-bold text-stone-900">
                Тиждень {resolvedWeekKey}
              </Text>
              {generatedAt ? (
                <Text className="text-xs text-stone-500">
                  Згенеровано{" "}
                  {generatedAt.toLocaleDateString("uk-UA", {
                    day: "numeric",
                    month: "long",
                  })}
                </Text>
              ) : (
                <Text className="text-xs text-stone-500">
                  Дайджест за цей тиждень ще не згенеровано. Увесь UI з’явиться
                  в наступному PR — зараз доступний лише тонкий футер із
                  статусом свіжості.
                </Text>
              )}
              <Button
                variant="secondary"
                onPress={onClose}
                className="mt-4 self-end"
                testID={testID ? `${testID}-close` : "weekly-digest-card-close"}
              >
                <Text className="text-sm font-semibold text-stone-900">
                  Закрити
                </Text>
              </Button>
            </View>
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
});
