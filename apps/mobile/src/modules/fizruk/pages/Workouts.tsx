/**
 * Fizruk / Workouts page — mobile scaffold (Phase 6 · PR-B).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Workouts.tsx` (626 LOC).
 *
 * PR-B scope (this file): wire the just-landed `useActiveFizrukWorkout`
 * hook + `RestTimerOverlay` so the active-workout timer and rest-timer
 * countdown are usable end-to-end from the Fizruk tab, even before the
 * full catalog / journal / templates screens land (PR-F). Shown on this
 * page today:
 *
 *   1. A top status card — either "немає активного тренування" with a
 *      "Start demo workout" button, or an active panel with elapsed time
 *      + quick-rest buttons (compound / isolation / cardio defaults from
 *      `@sergeant/fizruk-domain` so the same constants drive web + mobile)
 *      + a "Finish" button that clears the active workout.
 *   2. The floating `RestTimerOverlay` over the bottom safe area while a
 *      rest countdown is running.
 *   3. A roadmap card pointing at the follow-up PRs (PR-C … PR-G).
 *
 * This is **intentionally not** the full page — the exercise catalog,
 * active-set editing UI, journal and template drawer land with the
 * corresponding follow-up PRs. What is here is enough for the user to
 * exercise the timer hook from the real app and for us to unit-test
 * the same flow from jest.
 */

import { REST_DEFAULTS } from "@sergeant/fizruk-domain/lib/restSettings";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { RestTimerOverlay } from "../components/RestTimerOverlay";
import { useActiveFizrukWorkout } from "../hooks/useActiveFizrukWorkout";

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Workouts() {
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const {
    activeWorkoutId,
    setActiveWorkoutId,
    clearActiveWorkout,
    elapsedSec,
    restTimer,
    startRestTimer,
    cancelRestTimer,
  } = useActiveFizrukWorkout({ startedAt });

  const handleStartDemo = useCallback(() => {
    setStartedAt(new Date().toISOString());
    setActiveWorkoutId(`demo-${Date.now()}`);
  }, [setActiveWorkoutId]);

  const handleFinishDemo = useCallback(() => {
    clearActiveWorkout();
    setStartedAt(null);
    cancelRestTimer();
  }, [cancelRestTimer, clearActiveWorkout]);

  const elapsedLabel = useMemo(
    () => (elapsedSec !== null ? formatElapsed(elapsedSec) : "00:00"),
    [elapsedSec],
  );

  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 140,
          gap: 14,
        }}
      >
        <View>
          <Text className="text-[22px] font-bold text-stone-900">
            Тренування
          </Text>
          <Text className="text-sm text-stone-500">
            Активне тренування + таймер відпочинку (scaffold)
          </Text>
        </View>

        {activeWorkoutId ? (
          <Card variant="fizruk-soft" radius="lg" padding="lg">
            <View className="gap-3">
              <View>
                <Text className="text-xs font-semibold text-teal-800">
                  Активне тренування
                </Text>
                <Text
                  className="text-3xl font-extrabold text-stone-900"
                  accessibilityLabel={`Пройшло ${elapsedLabel}`}
                >
                  {elapsedLabel}
                </Text>
                <Text className="text-xs text-stone-500">
                  id: {activeWorkoutId}
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold text-stone-700">
                  Швидкий відпочинок
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => startRestTimer(REST_DEFAULTS.compound)}
                    accessibilityLabel={`Запустити таймер відпочинку ${REST_DEFAULTS.compound} секунд`}
                  >
                    {`Compound · ${REST_DEFAULTS.compound}s`}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => startRestTimer(REST_DEFAULTS.isolation)}
                    accessibilityLabel={`Запустити таймер відпочинку ${REST_DEFAULTS.isolation} секунд`}
                  >
                    {`Isolation · ${REST_DEFAULTS.isolation}s`}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => startRestTimer(REST_DEFAULTS.cardio)}
                    accessibilityLabel={`Запустити таймер відпочинку ${REST_DEFAULTS.cardio} секунд`}
                  >
                    {`Cardio · ${REST_DEFAULTS.cardio}s`}
                  </Button>
                </View>
              </View>

              <Button
                variant="destructive"
                size="md"
                onPress={handleFinishDemo}
                accessibilityLabel="Завершити активне тренування"
              >
                Завершити
              </Button>
            </View>
          </Card>
        ) : (
          <Card variant="fizruk-soft" radius="lg" padding="lg">
            <View className="gap-3">
              <View>
                <Text className="text-sm font-semibold text-teal-800">
                  Немає активного тренування
                </Text>
                <Text className="text-xs text-stone-600 leading-snug mt-1">
                  Запустити demo-сесію, щоб перевірити active-workout таймер і
                  таймер відпочинку. Справжній каталог вправ, активні сети й
                  журнал під&apos;єднуються у PR-F.
                </Text>
              </View>
              <Button
                variant="fizruk"
                size="md"
                onPress={handleStartDemo}
                accessibilityLabel="Почати тестове тренування"
              >
                Почати demo
              </Button>
            </View>
          </Card>
        )}

        <Card radius="lg" padding="md">
          <Text className="text-sm font-semibold text-stone-900">
            Наступні PR-и Фази 6
          </Text>
          <Text className="text-xs text-stone-500 leading-snug mt-1">
            PR-C — BodyAtlas. PR-D — графіки. PR-E — PhotoProgress. PR-F —
            повний каталог вправ + журнал + шаблони. PR-G — PlanCalendar.
          </Text>
        </Card>
      </ScrollView>

      <RestTimerOverlay restTimer={restTimer} onCancel={cancelRestTimer} />
    </SafeAreaView>
  );
}

export default Workouts;
