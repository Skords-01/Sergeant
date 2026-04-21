/**
 * Sergeant Hub — top-level dashboard screen (mobile).
 *
 * Structure today (top → bottom):
 *   1. Greeting + today label + settings button (always visible).
 *   2. Hero slot with one-hero rule: `FirstActionHeroCard` >
 *      `SoftAuthPromptCard` > `TodayFocusCard`, mirroring
 *      `apps/web/src/core/HubDashboard.tsx`.
 *   3. Status row stack (`DraggableDashboard`) with per-module
 *      quick-stats preview wired via `useModulePreviews`.
 *   4. `HubInsightsPanel` — collapsible secondary-recs block. Fed
 *      from `useDashboardFocus().rest` so dismissals share the
 *      same `hub_recs_dismissed_v1` map as the hero focus card.
 *   5. `WeeklyDigestFooter` — thin link to the weekly digest card,
 *      with a fresh-dot when the shared digest helper says the
 *      current digest is live.
 *
 * Scope notes:
 *   - Nutrition is hidden until Phase 7 (Food & Water). The persisted
 *     order still contains all four ids so a web session opening the
 *     same account keeps Nutrition in its slot — see
 *     `reorderWithHidden` in `@sergeant/shared`.
 *   - `onShowAuth` is stubbed with `Alert.alert` until the Better
 *     Auth native sheet lands in mobile nav. TODO: replace the alert
 *     with the actual sheet trigger once `packages/auth-client/expo`
 *     is wired.
 *   - Mobile `useWeeklyDigest` mutation hook is not ported yet, so
 *     `useMondayAutoDigest` is fed a no-op `generate`. The Monday-auto
 *     hook is harmless with a no-op — it still guards on the
 *     preference flag + absence of a current digest.
 */

import { router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUser } from "@sergeant/api-client/react";
import {
  isFirstActionPending,
  isFirstRealEntryDone,
  isSoftAuthDismissed,
  type DashboardModuleId,
  type KVStore,
} from "@sergeant/shared";

import { DraggableDashboard } from "./DraggableDashboard";
import { DASHBOARD_MODULE_ROUTES } from "./dashboardModuleConfig";
import { FirstActionHeroCard } from "./FirstActionHeroCard";
import { HubInsightsPanel, type InsightItem } from "./HubInsightsPanel";
import { SoftAuthPromptCard } from "./SoftAuthPromptCard";
import { TodayFocusCard } from "./TodayFocusCard";
import { useDashboardFocus } from "./useDashboardFocus";
import { useDashboardOrder } from "./useDashboardOrder";
import { useModulePreviews } from "./useModulePreviews";
import { useMondayAutoDigest } from "./useMondayAutoDigest";
import { WeeklyDigestFooter } from "./WeeklyDigestFooter";
import {
  safeReadLS as mmkvGet,
  safeRemoveLS as mmkvRemove,
  safeWriteLS as mmkvWrite,
} from "@/lib/storage";

const mmkvStore: KVStore = {
  getString(key) {
    try {
      const raw = mmkvGet<unknown>(key, null);
      if (raw === null || raw === undefined) return null;
      return typeof raw === "string" ? raw : JSON.stringify(raw);
    } catch {
      return null;
    }
  },
  setString(key, value) {
    try {
      mmkvWrite(key, value);
    } catch {
      /* noop */
    }
  },
  remove(key) {
    try {
      mmkvRemove(key);
    } catch {
      /* noop */
    }
  },
};

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
  const { focus, rest, dismiss: dismissFocus } = useDashboardFocus();
  const previews = useModulePreviews();

  useMondayAutoDigest({ generate: NOOP_GENERATE });

  // Hero-layer visibility gates. Read synchronously on every render
  // (MMKV is sync + cheap) so CTAs that flip these flags trigger a
  // one-frame re-eval without needing an event bus. Local state
  // ticks re-run the reads after inline dismissals. Booleans are
  // computed inline rather than via useMemo — per AGENTS.md rule 5.3
  // the memo overhead outweighs a single sync MMKV read.
  const [heroTick, setHeroTick] = useState(0);
  // Reference heroTick so React re-runs these reads after a bump.
  void heroTick;
  const firstActionPending = isFirstActionPending(mmkvStore);
  const softAuthDismissed = isSoftAuthDismissed(mmkvStore);
  const hasFirstRealEntry = isFirstRealEntryDone(mmkvStore);

  const openModule = useCallback((id: DashboardModuleId) => {
    // `DASHBOARD_MODULE_ROUTES` holds validated Expo-Router hrefs. We
    // cast to `Href` so the router's typed-href helper accepts them
    // without materialising a union of every literal string.
    router.push(DASHBOARD_MODULE_ROUTES[id] as Href);
  }, []);

  const openSettings = useCallback(() => {
    router.push("/settings" as Href);
  }, []);

  const bumpHero = useCallback(() => setHeroTick((t) => t + 1), []);

  const handleShowAuth = useCallback(() => {
    // TODO: replace with Better Auth native sheet once it lands in
    // mobile nav. Keeping a stub alert makes the CTA discoverable in
    // manual testing without pulling auth ahead of schedule.
    Alert.alert(
      "Акаунт скоро",
      "Sign-in screen на mobile ще в розробці. Поки синхронізація запуститься автоматично, коли акаунт буде готовий.",
    );
  }, []);

  // Insights panel is fed the `rest` slice from the shared focus
  // selector. Dismissing a panel item goes through the same
  // `dismiss()` as the hero card, so both share the
  // `hub_recs_dismissed_v1` dismissal map.
  const insightItems = useMemo<readonly InsightItem[]>(
    () =>
      rest.map((rec): InsightItem => {
        // `rec.module` is the shared `RecModule` (includes "hub");
        // `InsightItem.action` only accepts real module ids, so the
        // "hub" bucket surfaces without an inline open affordance.
        const isDashboardModule = rec.module !== "hub";
        return {
          id: rec.id,
          title: rec.title,
          body: rec.body,
          icon: rec.icon,
          module: rec.module,
          ...(isDashboardModule
            ? { action: rec.module as DashboardModuleId }
            : {}),
        };
      }),
    [rest],
  );

  const handleInsightDismiss = useCallback(
    (id: string) => {
      dismissFocus(id);
    },
    [dismissFocus],
  );

  // One-hero rule: exactly one hero renders per frame, in priority
  // order. `firstActionVisible` tracks the FTUX flag; `showSoftAuth`
  // gates on the post-FTUX window (real entry exists, not dismissed,
  // user not signed in); everything else falls back to the focus
  // card (which itself renders an empty state when no rec is live).
  const signedIn = Boolean(data?.user);
  const firstActionVisible = firstActionPending;
  const showSoftAuth =
    !firstActionVisible && hasFirstRealEntry && !softAuthDismissed && !signedIn;

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

        <View testID="dashboard-hero-slot">
          {firstActionVisible ? (
            <FirstActionHeroCard
              onAction={(id) => openModule(id)}
              onDismiss={bumpHero}
            />
          ) : showSoftAuth ? (
            <SoftAuthPromptCard
              onOpenAuth={handleShowAuth}
              onDismiss={bumpHero}
            />
          ) : (
            <TodayFocusCard
              focus={focus}
              onAction={(_actionKey, rec) => {
                if ((rec.module as DashboardModuleId) !== undefined) {
                  openModule(rec.module as DashboardModuleId);
                }
              }}
              onDismiss={dismissFocus}
              onQuickAdd={(id) => openModule(id)}
            />
          )}
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
          items={insightItems}
          onOpenModule={openModule}
          onDismiss={handleInsightDismiss}
        />

        <WeeklyDigestFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
