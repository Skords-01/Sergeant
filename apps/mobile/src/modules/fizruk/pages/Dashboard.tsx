/**
 * Fizruk / Dashboard page — mobile first cut (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Dashboard.tsx` (724 LOC).
 * The web page orchestrates many hooks (useRecovery, useWorkouts, useMonthlyPlan,
 * useWorkoutTemplates, useExerciseCatalog, BodyAtlas, templates sheet, …). Porting
 * all of that at once would make the shell PR unreviewable, so this first
 * cut is intentionally thin:
 *
 *   1. Greeting + localised date header.
 *   2. "Швидкий старт" card — primary CTA into `/fizruk/workouts` (the
 *      active-workout screen lands in PR-F).
 *   3. Grid of navigation cards into the other 8 Fizruk pages. Each card
 *      uses `router.push()` against `fizrukRouteFor()` from the shared
 *      route catalogue.
 *
 * Future PRs expand this page incrementally:
 *   - PR-C adds a mini BodyAtlas tile with recovery status.
 *   - PR-D adds WeeklyVolume + Wellbeing charts.
 *   - PR-F wires the "Швидкий старт" CTA to the active-workout timer.
 *   - PR-G adds today's scheduled template from PlanCalendar.
 *
 * No MMKV reads here yet — that plumbing (and the CloudSync enqueue
 * round-trip) lands together with the hooks they feed.
 */

import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import {
  FIZRUK_PAGES,
  fizrukRouteFor,
  type FizrukPage,
} from "../shell/fizrukRoute";

interface NavCard {
  id: FizrukPage;
  title: string;
  subtitle: string;
  glyph: string;
}

const NAV_CARDS: readonly NavCard[] = [
  {
    id: "workouts",
    title: "Тренування",
    subtitle: "Каталог + активна сесія",
    glyph: "💪",
  },
  {
    id: "plan",
    title: "План",
    subtitle: "Календар на місяць",
    glyph: "📅",
  },
  {
    id: "programs",
    title: "Програми",
    subtitle: "Готові тренувальні плани",
    glyph: "📋",
  },
  {
    id: "progress",
    title: "Прогрес",
    subtitle: "Графіки та бекапи",
    glyph: "📈",
  },
  {
    id: "body",
    title: "Тіло",
    subtitle: "Вимірювання та тренди",
    glyph: "🫀",
  },
  {
    id: "measurements",
    title: "Вимірювання",
    subtitle: "Вага, обхвати, самопочуття",
    glyph: "⚖️",
  },
  {
    id: "atlas",
    title: "Атлас",
    subtitle: "Карта груп м'язів",
    glyph: "🗺️",
  },
  {
    id: "exercise",
    title: "Вправа",
    subtitle: "Деталі вправи",
    glyph: "🏋️",
  },
] as const;

/**
 * Guard for `NAV_CARDS` coverage — every page except `dashboard` must
 * have exactly one entry. Runs at module-evaluation time so a typo
 * during edits surfaces as a test failure (see `Dashboard.test.tsx`).
 */
export function fizrukNavCardCoverage(): {
  missing: readonly FizrukPage[];
  extras: readonly FizrukPage[];
} {
  const expected = new Set<FizrukPage>(
    FIZRUK_PAGES.filter((p) => p !== "dashboard"),
  );
  const actual = new Set<FizrukPage>(NAV_CARDS.map((c) => c.id));
  const missing = [...expected].filter((id) => !actual.has(id));
  const extras = [...actual].filter((id) => !expected.has(id));
  return { missing, extras };
}

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

export function Dashboard() {
  const todayLabel = useMemo(() => formatToday(new Date()), []);

  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
      >
        <View>
          <Text className="text-[22px] font-bold text-stone-900">Сьогодні</Text>
          <Text
            accessibilityRole="text"
            className="text-sm text-stone-500 capitalize"
          >
            {todayLabel}
          </Text>
        </View>

        <Card variant="fizruk-soft" radius="lg" padding="lg">
          <View className="gap-3">
            <View>
              <Text className="text-sm font-semibold text-teal-800">
                Швидкий старт
              </Text>
              <Text className="text-xs text-teal-800/80 mt-0.5 leading-snug">
                Відкрий каталог тренувань — активну сесію з таймером додамо в
                наступному PR.
              </Text>
            </View>
            <Button
              variant="fizruk"
              size="md"
              onPress={() => router.push(fizrukRouteFor("workouts"))}
              accessibilityLabel="Перейти до тренувань"
            >
              До тренувань
            </Button>
          </View>
        </Card>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-stone-700">Розділи</Text>
          <View className="flex-row flex-wrap -mx-1">
            {NAV_CARDS.map((card) => (
              <View key={card.id} className="w-1/2 px-1 mb-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={card.title}
                  onPress={() => router.push(fizrukRouteFor(card.id))}
                  style={({ pressed }) =>
                    pressed ? { transform: [{ scale: 0.98 }] } : null
                  }
                >
                  <Card radius="lg" padding="md">
                    <View className="gap-1">
                      <Text className="text-xl">{card.glyph}</Text>
                      <Text className="text-sm font-semibold text-stone-900">
                        {card.title}
                      </Text>
                      <Text className="text-xs text-stone-500 leading-snug">
                        {card.subtitle}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <Card radius="lg" padding="md">
          <Text className="text-sm font-semibold text-stone-900">
            Фаза 6 · міграція Фізрука
          </Text>
          <Text className="text-xs text-stone-500 leading-snug mt-1">
            Це shell-PR. Контент сторінок (BodyAtlas, графіки, фотопрогрес,
            active-workout таймер, PlanCalendar) з&apos;являється в наступних
            PR-ах за планом у `docs/react-native-migration.md` §2.4.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Dashboard;
