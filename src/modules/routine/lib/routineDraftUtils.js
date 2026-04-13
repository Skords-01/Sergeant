import { dateKeyFromDate } from "./hubCalendarAggregate.js";

export function routineTodayDate() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function emptyHabitDraft() {
  const t = routineTodayDate();
  return {
    name: "",
    emoji: "✓",
    tagIds: [],
    categoryId: null,
    recurrence: "daily",
    startDate: dateKeyFromDate(t),
    endDate: "",
    timeOfDay: "",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };
}

export function habitDraftToPatch(draft) {
  const tagIds = draft.tagIds || [];
  return {
    name: draft.name.trim(),
    emoji: draft.emoji || "✓",
    tagIds,
    categoryId: draft.categoryId || null,
    recurrence: draft.recurrence || "daily",
    startDate: draft.startDate || dateKeyFromDate(routineTodayDate()),
    endDate:
      draft.endDate && String(draft.endDate).trim()
        ? String(draft.endDate).trim()
        : null,
    timeOfDay:
      draft.timeOfDay && String(draft.timeOfDay).trim()
        ? String(draft.timeOfDay).trim().slice(0, 5)
        : "",
    weekdays: Array.isArray(draft.weekdays)
      ? draft.weekdays
      : [0, 1, 2, 3, 4, 5, 6],
  };
}
