import { dateKeyFromDate } from "./hubCalendarAggregate.js";

export function routineTodayDate() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export const REMINDER_PRESETS = [
  { id: "morning", label: "Ранок", times: ["08:00"] },
  { id: "afternoon", label: "День", times: ["13:00"] },
  { id: "evening", label: "Вечір", times: ["20:00"] },
  { id: "twice", label: "Ранок + Вечір", times: ["08:00", "20:00"] },
  { id: "thrice", label: "Ранок / День / Вечір", times: ["08:00", "13:00", "20:00"] },
];

export function normalizeReminderTimes(habit) {
  if (Array.isArray(habit.reminderTimes) && habit.reminderTimes.length > 0) {
    return habit.reminderTimes.filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
  }
  const legacy = habit.timeOfDay && String(habit.timeOfDay).trim();
  if (legacy && /^\d{2}:\d{2}$/.test(legacy)) return [legacy];
  return [];
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
    reminderTimes: [],
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };
}

export function habitDraftToPatch(draft) {
  const tagIds = draft.tagIds || [];
  const reminderTimes = (draft.reminderTimes || [])
    .map((t) => String(t || "").trim().slice(0, 5))
    .filter((t) => /^\d{2}:\d{2}$/.test(t));

  const timeOfDay = reminderTimes[0] || (
    draft.timeOfDay && String(draft.timeOfDay).trim()
      ? String(draft.timeOfDay).trim().slice(0, 5)
      : ""
  );

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
    timeOfDay,
    reminderTimes,
    weekdays: Array.isArray(draft.weekdays)
      ? draft.weekdays
      : [0, 1, 2, 3, 4, 5, 6],
  };
}
