/**
 * Sergeant Hub — top-level dashboard screen (mobile).
 *
 * Structure today (top → bottom):
 *   1. Greeting + today label + settings button (always visible).
 *   2. Status row stack (`DraggableDashboard`) with per-module
 *      quick-stats preview wired via `useModulePreviews`.
 *   3. `HubInsightsPanel` — collapsible secondary-recs block. Fed
 *      from `useDashboardFocus().rest` once PR-2 (hero-card layer)
 *      lands; until then we pass an empty array so the panel
 *      self-hides.
 *   4. `WeeklyDigestFooter` — thin link to the weekly digest card,
 *      with a fresh-dot when the shared digest helper says the
 *      current digest is live.
 *
 * Not in scope for this PR (deliberately deferred — see
 * `docs/react-native-migration.md` §2.2):
 *   - `TodayFocusCard` + `useDashboardFocus` (hero slot) → PR-2.
 *   - Full `WeeklyDigestCard` port (currently a placeholder modal
 *     inside `WeeklyDigestFooter`).
 *   - Mobile `useWeeklyDigest` mutation hook: `useMondayAutoDigest`
 *     reads the pure signals but the `generate` side stays stubbed.
 */

import { router, type Href } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUser } from "@sergeant/api-client/react";
import type { DashboardModuleId } from "@sergeant/shared";

import { DraggableDashboard } from "./DraggableDashboard";
import { DASHBOARD_MODULE_ROUTES } from "./dashboardModuleConfig";
import { HubInsightsPanel, type InsightItem } from "./HubInsightsPanel";
import { useDashboardOrder } from "./useDashboardOrder";
import { useModulePreviews } from "./useModulePreviews";
import { useMondayAutoDigest } from "./useMondayAutoDigest";
import { WeeklyDigestFooter } from "./WeeklyDigestFooter";

// TODO(hub-dashboard-pr-2): wire to `useDashboardFocus().rest` once the
// PR-2 (hero / TodayFocusCard) branch merges. Until then the insights
// panel stays self-hiding because `items.length === 0`.
const INSIGHTS_REST_STUB: readonly InsightItem[] = [];

// TODO(weekly-digest): swap with the `generate` handle returned by the
// ported mobile `useWeeklyDigest` hook once that lands. The Monday-auto
// hook is harmless with a no-op `generate` — it still guards on the
// preference flag + absence of a current digest.
const NOOP_GENERATE = () => {
  /* weekly-digest mutation hook is not on mobile yet */
};

function formatToday(now: Date): string {
  try {
    return now.toLocaleDateString("uk-UA", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    // Hermes without Intl (shouldn't happen on RN 0.76, but stay safe).
    return now.toDateString();
  }
}

function firstName(name: string | null | undefined): string {
  if (!name) return "друже";
  const trimmed = name.trim();
  if (!trimmed) return "друже";
  const [first] = trimmed.split(/\s+/);
  return first ?? trimmed;
}

export function HubDashboard() {
  const { data } = useUser();
  const greetingName = firstName(data?.user?.name);
  const todayLabel = useMemo(() => formatToday(new Date()), []);

  const { visibleOrder, reorderVisible } = useDashboardOrder();
  const previews = useModulePreviews();

  useMondayAutoDigest({ generate: NOOP_GENERATE });

  const openModule = useCallback((id: DashboardModuleId) => {
    // `DASHBOARD_MODULE_ROUTES` holds validated Expo-Router hrefs. We
    // cast to `Href` so the router's typed-href helper accepts them
    // without materialising a union of every literal string.
    router.push(DASHBOARD_MODULE_ROUTES[id] as Href);
  }, []);

  const openSettings = useCallback(() => {
    router.push("/settings" as Href);
  }, []);

  const handleInsightDismiss = useCallback((_id: string) => {
    // TODO(hub-dashboard-pr-2): forward to `useDashboardFocus().dismiss`
    // once available. For now this is a no-op because the panel is fed
    // an empty array.
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[26px] font-bold text-stone-900">
              Привіт, {greetingName}
            </Text>
            <Text
              accessibilityRole="text"
              className="text-sm text-stone-500 capitalize"
            >
              {todayLabel}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Відкрити налаштування"
            onPress={openSettings}
            className="h-10 w-10 items-center justify-center rounded-full bg-cream-100 active:opacity-70"
            testID="dashboard-settings-button"
          >
            <Text className="text-lg">⚙️</Text>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-stone-600">Статус</Text>
          <DraggableDashboard
            modules={visibleOrder}
            onReorder={reorderVisible}
            onOpenModule={openModule}
            previews={previews}
          />
          <Text className="mt-1 text-[11px] leading-snug text-stone-400">
            Утримай і потягни, щоб змінити порядок модулів. Порядок
            синхронізується з вебом.
          </Text>
        </View>

        <HubInsightsPanel
          items={INSIGHTS_REST_STUB}
          onOpenModule={openModule}
          onDismiss={handleInsightDismiss}
        />

        <WeeklyDigestFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
