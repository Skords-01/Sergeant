import { useState } from "react";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { useToast } from "@shared/hooks/useToast";
import {
  loadRoutineState,
  createHabit,
  deleteHabit,
  updateHabit,
  applyRoutineBackupPayload,
} from "../lib/routineStorage.js";
import { dateKeyFromDate } from "../lib/hubCalendarAggregate.js";
import { ROUTINE_THEME as C } from "../lib/routineConstants.js";
import {
  emptyHabitDraft,
  habitDraftToPatch,
  routineTodayDate,
  normalizeReminderTimes,
} from "../lib/routineDraftUtils.js";
import { HabitDetailSheet } from "./HabitDetailSheet.jsx";
import { RoutineBackupSection } from "./RoutineBackupSection.jsx";
import { HabitForm } from "./settings/HabitForm.jsx";
import { TagsSection } from "./settings/TagsSection.jsx";
import { CategoriesSection } from "./settings/CategoriesSection.jsx";
import { ActiveHabitsSection } from "./settings/ActiveHabitsSection.jsx";
import { ArchivedHabitsSection } from "./settings/ArchivedHabitsSection.jsx";

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
}) {
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [detailHabitId, setDetailHabitId] = useState(null);
  const [deleteHabitPending, setDeleteHabitPending] = useState(null);
  const [importConfirm, setImportConfirm] = useState(null);

  const loadHabitIntoDraft = (h) => {
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
  };

  const saveHabit = () => {
    const patch = habitDraftToPatch(habitDraft);
    if (!patch.name) return;
    if (
      patch.recurrence === "weekly" &&
      (!patch.weekdays || patch.weekdays.length === 0)
    ) {
      toast.warning("Обери хоча б один день тижня.");
      return;
    }
    if (editingId) {
      setRoutine((s) => updateHabit(s, editingId, patch));
      cancelEdit();
    } else {
      setRoutine((s) => createHabit(s, patch));
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
            setRoutine((s) => deleteHabit(s, deleteHabitPending.id));
            if (
              !deleteHabitPending.archived &&
              editingId === deleteHabitPending.id
            )
              cancelEdit();
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
