/**
 * Sergeant Hub — top-level dashboard screen (mobile).
 *
 * This PR lands the hero layer on top of the structural skeleton that
 * PR-1 shipped:
 *
 *   - FTUX priority (`one-hero rule`): show exactly one of
 *     `FirstActionHeroCard` > `SoftAuthPromptCard` > `TodayFocusCard`,
 *     mirroring `apps/web/src/core/HubDashboard.tsx`.
 *   - `useDashboardFocus` (shared contract) drives the focus/rest
 *     split. The mobile recommendation generator is still a stub —
 *     see `./useDashboardFocus.ts` — so the card renders its empty
 *     state until Phase 3 wires up per-module stats readers.
 *
 * Follow-up PRs layer on the bits deliberately deferred here:
 *
 *   - Quick-stats previews inside each row → gated on the per-module
 *     MMKV writers (Phase 3 — quick-stats writers).
 *   - `HubInsightsPanel`, `WeeklyDigestFooter` → PR-3 of the
 *     dashboard breakdown.
 *   - PresetSheet / full onboarding modal flow — currently the
 *     FirstAction CTA routes into the target module instead of
 *     opening a preset sheet inline.
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
import { SoftAuthPromptCard } from "./SoftAuthPromptCard";
import { TodayFocusCard } from "./TodayFocusCard";
import { useDashboardFocus } from "./useDashboardFocus";
import { useDashboardOrder } from "./useDashboardOrder";
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
  const { focus, dismiss: dismissFocus } = useDashboardFocus();

  // Hero-layer visibility gates. Read synchronously on every render
  // (MMKV is sync + cheap) so CTAs that flip these flags trigger a
  // one-frame re-eval without needing an event bus. Local state
  // ticks re-run the reads after inline dismissals.
  const [heroTick, setHeroTick] = useState(0);
  const firstActionPending = useMemo(
    () => isFirstActionPending(mmkvStore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroTick],
  );
  const softAuthDismissed = useMemo(
    () => isSoftAuthDismissed(mmkvStore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroTick],
  );
  const hasFirstRealEntry = useMemo(
    () => isFirstRealEntryDone(mmkvStore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroTick],
  );

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
          />
          <Text className="mt-1 text-[11px] leading-snug text-stone-400">
            Утримай і потягни, щоб змінити порядок модулів. Порядок
            синхронізується з вебом.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
