/**
 * Sergeant Routine — HabitsPage (React Native)
 *
 * Mobile port of `apps/web/src/modules/routine/components/settings/
 * ActiveHabitsSection.tsx` + `ArchivedHabitsSection.tsx` (merged into
 * a single scrollable page on mobile — the settings tab is already
 * the host and there's no room for a separate route).
 *
 * Scope of this PR:
 *  - List of **active** habits (sorted by `habitOrder`, via
 *    `sortHabitsByOrder`), with an empty-state when the user has
 *    none yet.
 *  - List of **archived** habits below the divider, collapsed by
 *    default. Restore + delete per row.
 *  - Per-row actions: ↑ / ↓ reorder, «Змінити» (opens the form in
 *    edit mode), «В архів» / «Відновити», «Видалити» (two-tap
 *    confirmation — a second press within ~5s commits the delete).
 *  - Floating «+ Add» button in the bottom-right that opens the
 *    `HabitForm` sheet in new-habit mode.
 *  - Long-press + drag reorder for the active habits list, via
 *    `DraggableHabitList` (`react-native-gesture-handler` +
 *    Reanimated). The ↑ / ↓ buttons stay in place as the keyboard /
 *    screen-reader accessibility fallback, so the two reorder paths
 *    share `useRoutineStore` under the hood (`setHabitOrder` on drop,
 *    `moveHabitInOrder` on button tap).
 *
 * ALL mutations go through `useRoutineStore` (the same MMKV-backed
 * hook that `Calendar.tsx` uses), so persistence is unified — no
 * second storage layer.
 *
 * Deferred to follow-up PRs (flagged in the PR body):
 *  - Habit detail sheet / completion history.
 *  - Category & tag CRUD from this page (web has `TagsSection` and
 *    `CategoriesSection` cards; those screens land in a dedicated
 *    sub-tab of Settings later).
 */

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  sortHabitsByOrder,
  type Habit,
  type HabitDraftPatch,
} from "@sergeant/routine-domain";

import { useRoutineStore } from "../../lib/routineStore";
import { DraggableHabitList } from "./DraggableHabitList";
import { HabitForm } from "./HabitForm";
import { HabitListItem } from "./HabitListItem";

type FormState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; habit: Habit };

/** Delete confirmation pulse window — same "tap twice" pattern as Finyk. */
const DELETE_CONFIRM_MS = 5000;

export interface HabitsPageProps {
  /** Optional root `testID` — children derive stable sub-ids. */
  testID?: string;
}

export function HabitsPage({ testID }: HabitsPageProps) {
  const {
    routine,
    createHabit,
    updateHabit,
    setHabitArchived,
    deleteHabit,
    moveHabitInOrder,
    setHabitOrder,
  } = useRoutineStore();

  const [formState, setFormState] = useState<FormState>({ mode: "closed" });
  const [deletePending, setDeletePending] = useState<{
    id: string;
    expiresAt: number;
  } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const activeHabits = useMemo(
    () =>
      sortHabitsByOrder(
        routine.habits.filter((h) => !h.archived),
        routine.habitOrder || [],
      ),
    [routine.habits, routine.habitOrder],
  );

  const archivedHabits = useMemo(
    () => routine.habits.filter((h) => !!h.archived),
    [routine.habits],
  );

  const openNew = useCallback(() => {
    setFormState({ mode: "new" });
  }, []);

  const openEdit = useCallback((habit: Habit) => {
    setFormState({ mode: "edit", habit });
  }, []);

  const closeForm = useCallback(() => {
    setFormState({ mode: "closed" });
  }, []);

  const handleSubmit = useCallback(
    (patch: HabitDraftPatch) => {
      if (formState.mode === "edit") {
        updateHabit(formState.habit.id, patch);
      } else {
        createHabit(patch);
      }
    },
    [formState, createHabit, updateHabit],
  );

  const handleRequestDelete = useCallback(
    (id: string) => {
      const now = Date.now();
      if (
        deletePending &&
        deletePending.id === id &&
        deletePending.expiresAt > now
      ) {
        deleteHabit(id);
        setDeletePending(null);
      } else {
        setDeletePending({ id, expiresAt: now + DELETE_CONFIRM_MS });
      }
    },
    [deletePending, deleteHabit],
  );

  const pendingDeleteId =
    deletePending && deletePending.expiresAt > Date.now()
      ? deletePending.id
      : null;

  const editingId = formState.mode === "edit" ? formState.habit.id : null;

  return (
    <SafeAreaView
      className="flex-1 bg-cream-50"
      edges={["top"]}
      testID={testID}
    >
      <View className="flex-row items-center gap-2 px-4 pt-4 pb-1">
        <Text className="text-[22px]">⚙️</Text>
        <Text className="text-[22px] font-bold text-stone-900 flex-1">
          Звички
        </Text>
      </View>
      <Text className="px-4 text-sm text-stone-600 leading-snug mb-2">
        Додавай, редагуй і архівуй звички. Порядок у списку = порядок у
        календарі — використай ↑ / ↓ для зміни.
      </Text>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
      >
        <View className="rounded-2xl border border-cream-300 bg-white px-3 py-2">
          <Text className="text-sm font-semibold text-stone-900 mb-1">
            Активні звички
          </Text>
          {activeHabits.length === 0 ? (
            <View
              className="py-6 items-center"
              testID={testID ? `${testID}-empty` : undefined}
            >
              <Text className="text-sm text-stone-500">Поки порожньо</Text>
              <Text className="text-xs text-stone-400 mt-1 text-center">
                Натисни «+ Додати» нижче, щоб створити першу звичку.
              </Text>
            </View>
          ) : (
            <DraggableHabitList
              habits={activeHabits}
              onReorder={setHabitOrder}
              onMoveUp={(id) => moveHabitInOrder(id, -1)}
              onMoveDown={(id) => moveHabitInOrder(id, 1)}
              onStartEdit={openEdit}
              onArchive={(id) => setHabitArchived(id, true)}
              onRequestDelete={handleRequestDelete}
              editingId={editingId}
              pendingDeleteId={pendingDeleteId}
              testID={testID ? `${testID}-list` : undefined}
            />
          )}
        </View>

        <View className="rounded-2xl border border-cream-300 bg-white px-3 py-2">
          <Pressable
            onPress={() => setArchiveOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: archiveOpen }}
            testID={testID ? `${testID}-archive-toggle` : undefined}
            className="flex-row items-center justify-between py-1"
          >
            <Text className="text-sm font-semibold text-stone-900">
              Архів{" "}
              <Text className="text-xs font-normal text-stone-500">
                ({archivedHabits.length})
              </Text>
            </Text>
            <Text className="text-xs text-stone-500">
              {archiveOpen ? "▲" : "▼"}
            </Text>
          </Pressable>
          {archiveOpen ? (
            archivedHabits.length === 0 ? (
              <Text className="text-xs text-stone-500 py-3">
                Архів порожній.
              </Text>
            ) : (
              <View>
                {archivedHabits.map((h) => (
                  <HabitListItem
                    key={h.id}
                    habit={h}
                    editing={false}
                    archived
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    onStartEdit={() => openEdit(h)}
                    onArchive={() => {}}
                    onUnarchive={() => setHabitArchived(h.id, false)}
                    onRequestDelete={() => handleRequestDelete(h.id)}
                    testID={testID ? `${testID}-archived-${h.id}` : undefined}
                  />
                ))}
              </View>
            )
          ) : null}
        </View>

        {pendingDeleteId ? (
          <View className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2">
            <Text className="text-xs text-danger text-center">
              Ще раз «Видалити», щоб остаточно прибрати звичку.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="absolute right-4 bottom-6">
        <Pressable
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel="Додати звичку"
          testID={testID ? `${testID}-add` : undefined}
          className="h-14 px-5 rounded-full bg-coral-500 items-center justify-center shadow-lg"
        >
          <Text className="text-base font-bold text-white">+ Додати</Text>
        </Pressable>
      </View>

      <HabitForm
        open={formState.mode !== "closed"}
        onClose={closeForm}
        routine={routine}
        editingHabit={formState.mode === "edit" ? formState.habit : null}
        onSubmit={handleSubmit}
        testID={testID ? `${testID}-form` : undefined}
      />
    </SafeAreaView>
  );
}

export default HabitsPage;
