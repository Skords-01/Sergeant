/**
 * Fizruk / Workouts page — mobile port (Phase 6).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Workouts.tsx` (626 LOC).
 *
 * Full port of the three core surfaces of the web page:
 *   1. Active-workout status strip (start / elapsed / finish + quick rest buttons).
 *   2. Searchable, primary-group-filtered exercise catalogue (built-in +
 *      custom), routed through `@sergeant/fizruk-domain/domain/workouts`
 *      pure helpers.
 *   3. Journal — newest-first list of sessions grouped by local date,
 *      with per-row aggregate summaries.
 *
 * The catalogue tap → adds an exercise to the active workout; the
 * active-workout strip then reveals each item with an "add set" CTA
 * that opens the `ActiveSetEditor` sheet (weight / reps / optional
 * RPE, validated through the domain helpers, with haptics).
 *
 * Explicitly **excluded** from this port (covered by follow-up PRs):
 *   - Templates (WorkoutTemplates UI — PR #477 scoped it out).
 *   - Exercise detail sheet + recovery overlays (lands with the Exercise
 *     detail page PR).
 *   - Photo progress (ruled out by PR #468).
 *
 * Store integration: reuses `useActiveFizrukWorkout`, `useFizrukWorkouts`
 * and `useCustomExercises` — no new persisted slot. Both hooks already
 * route through `enqueueChange` (Task #7 pattern) so CloudSync picks
 * up changes automatically.
 */

import {
  exerciseDisplayName,
  type WorkoutExerciseCatalogEntry,
  type WorkoutSet,
} from "@sergeant/fizruk-domain/domain";
import { EXERCISES, PRIMARY_GROUPS_UK } from "@sergeant/fizruk-domain/data";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { router } from "expo-router";

import { hapticSuccess, hapticTap, hapticWarning } from "@sergeant/shared";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { RestTimerOverlay } from "../components/RestTimerOverlay";
import {
  ActiveSetEditor,
  ExerciseCatalogSection,
  WorkoutActivePanel,
  WorkoutJournalSection,
} from "../components/workouts";
import {
  useActiveFizrukWorkout,
  useElapsedSeconds,
} from "../hooks/useActiveFizrukWorkout";
import { useCustomExercises } from "../hooks/useCustomExercises";
import {
  useFizrukWorkouts,
  type FizrukWorkout,
  type FizrukWorkoutItem,
} from "../hooks/useFizrukWorkouts";

type WorkoutsMode = "catalog" | "log";

const MODE_ITEMS: ReadonlyArray<{ value: WorkoutsMode; label: string }> = [
  { value: "catalog", label: "Каталог" },
  { value: "log", label: "Журнал" },
];

interface SetEditorState {
  workoutId: string;
  itemId: string;
  setIndex: number | null;
  exerciseName: string;
  initial: WorkoutSet | null;
}

export interface WorkoutsProps {
  /** Optional root testID — sub-ids derive from it. */
  testID?: string;
}

export function Workouts({ testID = "fizruk-workouts" }: WorkoutsProps) {
  const { workouts, createWorkout, endWorkout, addItem, updateItem } =
    useFizrukWorkouts();
  const { exercises: customExercises } = useCustomExercises();

  const {
    activeWorkoutId,
    setActiveWorkoutId,
    clearActiveWorkout,
    restTimer,
    startRestTimer,
    cancelRestTimer,
  } = useActiveFizrukWorkout();

  const [mode, setMode] = useState<WorkoutsMode>("catalog");
  const [setEditor, setSetEditor] = useState<SetEditorState | null>(null);

  // Merged list: custom first, built-in after (deduped by id). We
  // don't route through `mergeExerciseCatalog` because that helper
  // insists on the stricter `RawExerciseDef` shape (required
  // `name.uk`); the mobile catalog entry type is deliberately more
  // permissive so legacy custom-exercise records never get dropped.
  const catalog = useMemo<WorkoutExerciseCatalogEntry[]>(() => {
    const custom: WorkoutExerciseCatalogEntry[] = customExercises.map((ex) => ({
      id: ex.id,
      name: { uk: ex.nameUk },
      primaryGroup: ex.primaryGroup,
      muscles: {
        primary: ex.musclesPrimary,
        secondary: ex.musclesSecondary,
      },
    }));
    const seen = new Set<string>();
    const out: WorkoutExerciseCatalogEntry[] = [];
    for (const ex of custom) {
      if (!ex.id || seen.has(ex.id)) continue;
      seen.add(ex.id);
      out.push(ex);
    }
    for (const ex of EXERCISES) {
      if (!ex.id || seen.has(ex.id)) continue;
      seen.add(ex.id);
      out.push(ex as WorkoutExerciseCatalogEntry);
    }
    return out;
  }, [customExercises]);

  const activeWorkout = useMemo<FizrukWorkout | null>(
    () => workouts.find((w) => w.id === activeWorkoutId) ?? null,
    [workouts, activeWorkoutId],
  );

  const elapsedSec = useElapsedSeconds(
    activeWorkout?.endedAt ? null : (activeWorkout?.startedAt ?? null),
  );

  const handleStart = useCallback(() => {
    hapticSuccess();
    const created = createWorkout();
    setActiveWorkoutId(created.id);
    setMode("catalog");
  }, [createWorkout, setActiveWorkoutId]);

  const handleFinish = useCallback(() => {
    if (!activeWorkoutId) return;
    hapticSuccess();
    endWorkout(activeWorkoutId);
    clearActiveWorkout();
    cancelRestTimer();
  }, [activeWorkoutId, cancelRestTimer, clearActiveWorkout, endWorkout]);

  const handleStartRest = useCallback(
    (sec: number) => {
      hapticTap();
      startRestTimer(sec);
    },
    [startRestTimer],
  );

  const handlePickExercise = useCallback(
    (ex: WorkoutExerciseCatalogEntry) => {
      if (!activeWorkoutId) {
        hapticWarning();
        // Auto-start a workout for convenience.
        const created = createWorkout();
        setActiveWorkoutId(created.id);
        const isCardio = ex.primaryGroup === "cardio";
        const itemPatch: Partial<FizrukWorkoutItem> = {
          exerciseId: ex.id,
          nameUk: exerciseDisplayName(ex),
          primaryGroup: ex.primaryGroup,
          musclesPrimary: ex.muscles?.primary ?? [],
          musclesSecondary: ex.muscles?.secondary ?? [],
          type: isCardio ? "distance" : "strength",
          sets: isCardio ? undefined : [],
        };
        addItem(created.id, itemPatch);
        return;
      }
      hapticTap();
      const isCardio = ex.primaryGroup === "cardio";
      addItem(activeWorkoutId, {
        exerciseId: ex.id,
        nameUk: exerciseDisplayName(ex),
        primaryGroup: ex.primaryGroup,
        musclesPrimary: ex.muscles?.primary ?? [],
        musclesSecondary: ex.muscles?.secondary ?? [],
        type: isCardio ? "distance" : "strength",
        sets: isCardio ? undefined : [],
      });
    },
    [activeWorkoutId, addItem, createWorkout, setActiveWorkoutId],
  );

  const handleInspectExercise = useCallback(
    (ex: WorkoutExerciseCatalogEntry) => {
      hapticTap();
      router.push({
        pathname: "/fizruk/exercise",
        params: { id: ex.id },
      });
    },
    [],
  );

  const openNewSetEditor = useCallback(
    (item: FizrukWorkoutItem) => {
      if (!activeWorkoutId) return;
      setSetEditor({
        workoutId: activeWorkoutId,
        itemId: item.id,
        setIndex: null,
        exerciseName: item.nameUk || "Вправа",
        initial: null,
      });
    },
    [activeWorkoutId],
  );

  const openEditSetEditor = useCallback(
    (item: FizrukWorkoutItem, setIndex: number) => {
      if (!activeWorkoutId) return;
      const seed = item.sets?.[setIndex] ?? null;
      setSetEditor({
        workoutId: activeWorkoutId,
        itemId: item.id,
        setIndex,
        exerciseName: item.nameUk || "Вправа",
        initial: seed,
      });
    },
    [activeWorkoutId],
  );

  const handleSetSubmit = useCallback(
    (set: WorkoutSet) => {
      if (!setEditor) return;
      const workout = workouts.find((w) => w.id === setEditor.workoutId);
      if (!workout) return;
      const item = workout.items.find((it) => it.id === setEditor.itemId);
      if (!item) return;
      const existing: WorkoutSet[] = Array.isArray(item.sets)
        ? (item.sets.slice() as WorkoutSet[])
        : [];
      if (setEditor.setIndex === null) {
        existing.push(set);
      } else {
        existing[setEditor.setIndex] = set;
      }
      updateItem(setEditor.workoutId, setEditor.itemId, { sets: existing });
      setSetEditor(null);
    },
    [setEditor, updateItem, workouts],
  );

  const closeSetEditor = useCallback(() => setSetEditor(null), []);

  const activeItems = activeWorkout?.items ?? [];

  return (
    <SafeAreaView
      className="flex-1 bg-cream-50"
      edges={["top"]}
      testID={testID}
    >
      <View className="flex-row items-center gap-2 px-4 pt-4 pb-1">
        <Text className="text-[22px]">🏋️</Text>
        <Text className="text-[22px] font-bold text-stone-900 flex-1">
          Тренування
        </Text>
      </View>
      <Text className="px-4 text-sm text-stone-600 leading-snug mb-3">
        Каталог вправ, активне тренування і журнал — все в одному місці.
      </Text>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 16 }}
        testID={`${testID}-scroll`}
      >
        <WorkoutActivePanel
          activeWorkoutId={activeWorkoutId}
          elapsedSec={elapsedSec}
          onStart={handleStart}
          onFinish={handleFinish}
          onStartRest={handleStartRest}
          testID={`${testID}-active`}
        />

        {activeWorkout && activeItems.length > 0 ? (
          <View className="gap-3" testID={`${testID}-items`}>
            <Text className="text-sm font-semibold text-stone-900 px-1">
              Вправи тренування
            </Text>
            <View className="gap-3">
              {activeItems.map((item) => (
                <ActiveItemCard
                  key={item.id}
                  item={item}
                  onAddSet={() => openNewSetEditor(item)}
                  onEditSet={(setIndex) => openEditSetEditor(item, setIndex)}
                  testID={`${testID}-item-${item.id}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View className="flex-row gap-2 px-0" testID={`${testID}-segmented`}>
          {MODE_ITEMS.map((entry) => {
            const active = mode === entry.value;
            return (
              <Pressable
                key={entry.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={entry.label}
                onPress={() => setMode(entry.value)}
                testID={`${testID}-mode-${entry.value}`}
                className={
                  active
                    ? "flex-1 h-10 rounded-2xl bg-teal-600 items-center justify-center"
                    : "flex-1 h-10 rounded-2xl bg-cream-100 border border-cream-300 items-center justify-center"
                }
              >
                <Text
                  className={
                    active
                      ? "text-sm font-semibold text-white"
                      : "text-sm font-semibold text-stone-700"
                  }
                >
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "catalog" ? (
          <ExerciseCatalogSection
            onInspectExercise={handleInspectExercise}
            exercises={catalog}
            primaryGroupsUk={PRIMARY_GROUPS_UK}
            onPickExercise={handlePickExercise}
            testID={`${testID}-catalog`}
          />
        ) : (
          <WorkoutJournalSection
            workouts={workouts}
            activeWorkoutId={activeWorkoutId}
            testID={`${testID}-journal`}
          />
        )}
      </ScrollView>

      {restTimer ? (
        <RestTimerOverlay restTimer={restTimer} onCancel={cancelRestTimer} />
      ) : null}

      <ActiveSetEditor
        open={!!setEditor}
        onClose={closeSetEditor}
        exerciseName={setEditor?.exerciseName ?? ""}
        setIndex={
          setEditor?.setIndex === null || setEditor === null
            ? undefined
            : setEditor.setIndex + 1
        }
        initialSet={setEditor?.initial ?? null}
        onSubmit={handleSetSubmit}
        testID={`${testID}-set-editor`}
      />
    </SafeAreaView>
  );
}

interface ActiveItemCardProps {
  item: FizrukWorkoutItem;
  onAddSet(): void;
  onEditSet(setIndex: number): void;
  testID: string;
}

function ActiveItemCard({
  item,
  onAddSet,
  onEditSet,
  testID,
}: ActiveItemCardProps) {
  const sets = Array.isArray(item.sets) ? item.sets : [];
  return (
    <Card variant="default" radius="lg" padding="md" testID={testID}>
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text
            className="text-sm font-semibold text-stone-900 flex-1 pr-2"
            numberOfLines={2}
          >
            {item.nameUk || "Вправа"}
          </Text>
          {item.primaryGroup ? (
            <Text className="text-[10px] uppercase font-bold text-stone-500">
              {item.primaryGroup}
            </Text>
          ) : null}
        </View>

        {sets.length > 0 ? (
          <View className="gap-1" testID={`${testID}-sets`}>
            {sets.map((set, idx) => {
              const hasData = (set?.weightKg ?? 0) > 0 || (set?.reps ?? 0) > 0;
              return (
                <Pressable
                  key={idx}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasData
                      ? `Редагувати сет ${idx + 1}: ${set?.weightKg ?? 0} на ${set?.reps ?? 0}`
                      : `Заповнити сет ${idx + 1}`
                  }
                  onPress={() => onEditSet(idx)}
                  testID={`${testID}-set-${idx}`}
                  className="flex-row items-center justify-between px-2 py-1.5 rounded-lg bg-cream-100"
                >
                  <Text className="text-xs font-semibold text-stone-600">
                    #{idx + 1}
                  </Text>
                  <Text className="text-sm text-stone-900">
                    {hasData
                      ? `${set?.weightKg ?? 0} кг × ${set?.reps ?? 0}`
                      : "—"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Button
          variant="fizruk-soft"
          size="sm"
          onPress={onAddSet}
          accessibilityLabel="Додати сет"
          testID={`${testID}-add-set`}
        >
          + Додати сет
        </Button>
      </View>
    </Card>
  );
}
