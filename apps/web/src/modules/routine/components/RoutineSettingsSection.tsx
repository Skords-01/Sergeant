import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { useToast } from "@shared/hooks/useToast";
import { hapticSuccess } from "@shared/lib/haptic";
import { showUndoToast } from "@shared/lib/undoToast";
import {
  loadRoutineState,
  createHabit,
  deleteHabit,
  updateHabit,
  applyRoutineBackupPayload,
  snapshotHabit,
  restoreHabit,
} from "../lib/routineStorage.js";
import { dateKeyFromDate } from "../lib/hubCalendarAggregate.js";
import { ROUTINE_THEME as C } from "../lib/routineConstants.js";
import {
  emptyHabitDraft,
  habitDraftToPatch,
  routineTodayDate,
  normalizeReminderTimes,
} from "../lib/routineDraftUtils.js";
import { HabitDetailSheet } from "./HabitDetailSheet";
import { RoutineBackupSection } from "./RoutineBackupSection";
import { HabitForm, type HabitFormErrors } from "./settings/HabitForm";
import { TagsSection } from "./settings/TagsSection";
import { CategoriesSection } from "./settings/CategoriesSection";
import { ActiveHabitsSection } from "./settings/ActiveHabitsSection";
import { ArchivedHabitsSection } from "./settings/ArchivedHabitsSection";
import type {
  CategoryDraft,
  Habit,
  HabitDraft,
  PendingHabitDeletion,
  RoutineState,
} from "../lib/types";

interface ImportConfirmState {
  parsed: unknown;
}

export interface RoutineSettingsSectionProps {
  routine: RoutineState;
  setRoutine: Dispatch<SetStateAction<RoutineState>>;
  habitDraft: HabitDraft;
  setHabitDraft: Dispatch<SetStateAction<HabitDraft>>;
  tagDraft: string;
  setTagDraft: Dispatch<SetStateAction<string>>;
  catDraft: CategoryDraft;
  setCatDraft: Dispatch<SetStateAction<CategoryDraft>>;
  onOpenCalendar?: () => void;
  habitFormFocusTick?: number;
  hidden?: boolean;
}

export function RoutineSettingsSection({
  routine,
  setRoutine,
  habitDraft,
  setHabitDraft,
  tagDraft,
  setTagDraft,
  catDraft,
  setCatDraft,
  onOpenCalendar,
  habitFormFocusTick,
  hidden: panelHidden,
}: RoutineSettingsSectionProps) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailHabitId, setDetailHabitId] = useState<string | null>(null);
  const [deleteHabitPending, setDeleteHabitPending] =
    useState<PendingHabitDeletion | null>(null);
  const [importConfirm, setImportConfirm] = useState<ImportConfirmState | null>(
    null,
  );
  const [habitErrors, setHabitErrors] = useState<HabitFormErrors>({});

  // Clear field errors as soon as the user edits the relevant field so the
  // red border doesn't linger once they start fixing the input. Parallels
  // the behaviour in `HabitQuickCreateDialog` — keeps validation feedback
  // consistent between the two hosts of `HabitForm`.
  useEffect(() => {
    if (habitErrors.name && habitDraft.name.trim()) {
      setHabitErrors((e) => ({ ...e, name: undefined }));
    }
  }, [habitDraft.name, habitErrors.name]);
  useEffect(() => {
    if (
      habitErrors.weekdays &&
      Array.isArray(habitDraft.weekdays) &&
      habitDraft.weekdays.length > 0
    ) {
      setHabitErrors((e) => ({ ...e, weekdays: undefined }));
    }
  }, [habitDraft.weekdays, habitErrors.weekdays]);

  const loadHabitIntoDraft = (h: Habit) => {
    const times = normalizeReminderTimes(h);
    setHabitDraft({
      name: h.name || "",
      emoji: h.emoji || "✓",
      tagIds: h.tagIds || [],
      categoryId: h.categoryId || null,
      recurrence: h.recurrence || "daily",
      startDate: h.startDate || dateKeyFromDate(routineTodayDate()),
      endDate: h.endDate || "",
      timeOfDay: h.timeOfDay || "",
      reminderTimes: times,
      weekdays:
        Array.isArray(h.weekdays) && h.weekdays.length
          ? h.weekdays
          : [0, 1, 2, 3, 4, 5, 6],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHabitDraft(emptyHabitDraft());
    setHabitErrors({});
  };

  const saveHabit = () => {
    const patch = habitDraftToPatch(habitDraft);
    // Inline validation — mirror `HabitQuickCreateDialog` so the user sees
    // exactly which field to fix (red border + message) instead of a
    // silent no-op for the name or a toast-only warning for the weekdays.
    const nextErrors: HabitFormErrors = {};
    if (!patch.name) {
      nextErrors.name = "Додай назву звички.";
    }
    if (
      patch.recurrence === "weekly" &&
      (!patch.weekdays || patch.weekdays.length === 0)
    ) {
      nextErrors.weekdays = "Обери хоча б один день тижня.";
    }
    if (nextErrors.name || nextErrors.weekdays) {
      setHabitErrors(nextErrors);
      return;
    }
    setHabitErrors({});
    if (editingId) {
      setRoutine((s) => updateHabit(s, editingId, patch));
      hapticSuccess();
      toast.success("Звичку оновлено.");
      cancelEdit();
    } else {
      setRoutine((s) => createHabit(s, patch));
      hapticSuccess();
      toast.success("Звичку створено.");
      setHabitDraft(emptyHabitDraft());
    }
  };

  return (
    <div
      role="tabpanel"
      id="routine-panel-settings"
      aria-labelledby="routine-tab-settings"
      hidden={panelHidden}
      className="space-y-4 pb-4"
    >
      <RoutineBackupSection
        theme={C}
        toast={toast}
        onImportParsed={(parsed) => setImportConfirm({ parsed })}
      />

      <HabitForm
        routine={routine}
        habitDraft={habitDraft}
        setHabitDraft={setHabitDraft}
        editingId={editingId}
        onSave={saveHabit}
        onCancel={cancelEdit}
        focusTick={habitFormFocusTick}
        errors={habitErrors}
      />

      <TagsSection
        routine={routine}
        setRoutine={setRoutine}
        tagDraft={tagDraft}
        setTagDraft={setTagDraft}
      />

      <CategoriesSection
        routine={routine}
        setRoutine={setRoutine}
        catDraft={catDraft}
        setCatDraft={setCatDraft}
      />

      <ActiveHabitsSection
        routine={routine}
        setRoutine={setRoutine}
        editingId={editingId}
        onEdit={(h) => {
          setEditingId(h.id);
          loadHabitIntoDraft(h);
        }}
        onCancelEditIf={(id) => {
          if (editingId === id) cancelEdit();
        }}
        onOpenDetails={(id) => setDetailHabitId(id)}
        onOpenCalendar={onOpenCalendar}
        onRequestDelete={(pending) => setDeleteHabitPending(pending)}
      />

      <ArchivedHabitsSection
        routine={routine}
        setRoutine={setRoutine}
        onRequestDelete={(pending) => setDeleteHabitPending(pending)}
      />

      <ConfirmDialog
        open={!!deleteHabitPending}
        title={
          deleteHabitPending?.archived
            ? `Видалити «${deleteHabitPending?.name}» назавжди?`
            : `Видалити звичку «${deleteHabitPending?.name}»?`
        }
        description={
          deleteHabitPending?.archived
            ? "Звичку буде видалено повністю разом з усіма відмітками."
            : "Відмітки по днях теж зникнуть. Замість видалення можна відправити звичку в архів."
        }
        confirmLabel="Видалити"
        onConfirm={() => {
          if (deleteHabitPending) {
            const pending = deleteHabitPending;
            let snapshot: ReturnType<typeof snapshotHabit> = null;
            setRoutine((s) => {
              snapshot = snapshotHabit(s, pending.id);
              return deleteHabit(s, pending.id);
            });
            if (!pending.archived && editingId === pending.id) cancelEdit();
            if (snapshot) {
              showUndoToast(toast, {
                msg: `Видалено звичку «${pending.name}»`,
                onUndo: () => setRoutine((s) => restoreHabit(s, snapshot)),
              });
            }
          }
          setDeleteHabitPending(null);
        }}
        onCancel={() => setDeleteHabitPending(null)}
      />

      <ConfirmDialog
        open={!!importConfirm}
        title="Імпорт резервної копії"
        description="Імпорт замінить усі поточні дані Рутини (звички, відмітки, відтискання) даними з файлу. Продовжити?"
        confirmLabel="Імпортувати"
        danger={false}
        onConfirm={() => {
          if (importConfirm?.parsed) {
            try {
              applyRoutineBackupPayload(importConfirm.parsed);
              setRoutine(loadRoutineState());
              toast.success("Резервну копію імпортовано.");
            } catch (err) {
              toast.error(err?.message || "Не вдалося імпортувати файл.");
            }
          }
          setImportConfirm(null);
        }}
        onCancel={() => setImportConfirm(null)}
      />
      {detailHabitId && (
        <HabitDetailSheet
          habitId={detailHabitId}
          routine={routine}
          onClose={() => setDetailHabitId(null)}
        />
      )}
    </div>
  );
}
