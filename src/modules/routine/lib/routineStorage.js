/** Hub «Рутина»: звички, теги, категорії (не-спорт), localStorage */

import { dateKeyFromDate } from "./hubCalendarAggregate.js";

export const ROUTINE_STORAGE_KEY = "hub_routine_v1";

export const ROUTINE_EVENT = "hub-routine-storage";

export function emitRoutineStorage() {
  try {
    window.dispatchEvent(new CustomEvent(ROUTINE_EVENT));
  } catch {
    /* noop */
  }
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeHabit(h) {
  if (!h || typeof h !== "object") return h;
  const created = h.createdAt ? String(h.createdAt).slice(0, 10) : dateKeyFromDate(new Date());
  return {
    ...h,
    recurrence: h.recurrence || "daily",
    startDate: h.startDate || created,
    endDate: h.endDate === undefined ? null : h.endDate,
    timeOfDay: h.timeOfDay === undefined ? "" : String(h.timeOfDay),
    weekdays: Array.isArray(h.weekdays) && h.weekdays.length ? h.weekdays : [0, 1, 2, 3, 4, 5, 6],
  };
}

const defaultState = () => ({
  schemaVersion: 2,
  prefs: {
    showFizrukInCalendar: true,
    tagScope: "routine",
    /** Браузерні нагадування у вказаний час (якщо дозволено Notification) */
    routineRemindersEnabled: false,
  },
  tags: [],
  categories: [],
  habits: [],
  completions: {},
});

export function loadRoutineState() {
  try {
    const raw = localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    return {
      ...defaultState(),
      ...p,
      prefs: { ...defaultState().prefs, ...(p.prefs || {}) },
      tags: Array.isArray(p.tags) ? p.tags : [],
      categories: Array.isArray(p.categories) ? p.categories : [],
      habits: Array.isArray(p.habits) ? p.habits.map(normalizeHabit) : [],
      completions: typeof p.completions === "object" && p.completions ? p.completions : {},
    };
  } catch {
    return defaultState();
  }
}

export function saveRoutineState(next) {
  try {
    localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(next));
    emitRoutineStorage();
  } catch {
    /* noop */
  }
}

export function createTag(state, name) {
  const n = (name || "").trim();
  if (!n) return state;
  const t = { id: uid("tag"), name: n, scope: state.prefs?.tagScope || "routine" };
  const next = { ...state, tags: [...state.tags, t] };
  saveRoutineState(next);
  return next;
}

export function createCategory(state, name, emoji = "") {
  const n = (name || "").trim();
  if (!n) return state;
  const c = { id: uid("cat"), name: n, emoji: emoji || undefined };
  const next = { ...state, categories: [...state.categories, c] };
  saveRoutineState(next);
  return next;
}

export function createHabit(
  state,
  {
    name,
    emoji = "✓",
    tagIds = [],
    categoryId = null,
    recurrence = "daily",
    startDate = null,
    endDate = null,
    timeOfDay = "",
    weekdays = [0, 1, 2, 3, 4, 5, 6],
  } = {},
) {
  const n = (name || "").trim();
  if (!n) return state;
  const sd = (startDate && String(startDate).trim()) || dateKeyFromDate(new Date());
  const h = normalizeHabit({
    id: uid("hab"),
    name: n,
    emoji: emoji || "✓",
    tagIds: Array.isArray(tagIds) ? tagIds : [],
    categoryId: categoryId || null,
    createdAt: new Date().toISOString(),
    archived: false,
    recurrence,
    startDate: sd,
    endDate: endDate && String(endDate).trim() ? String(endDate).trim() : null,
    timeOfDay: timeOfDay && String(timeOfDay).trim() ? String(timeOfDay).trim().slice(0, 5) : "",
    weekdays: Array.isArray(weekdays) ? [...new Set(weekdays)].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6],
  });
  const next = { ...state, habits: [...state.habits, h], completions: { ...state.completions } };
  saveRoutineState(next);
  return next;
}

export function updateHabit(state, id, patch) {
  const next = {
    ...state,
    habits: state.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
  };
  saveRoutineState(next);
  return next;
}

export function setPref(state, key, value) {
  const next = { ...state, prefs: { ...state.prefs, [key]: value } };
  saveRoutineState(next);
  return next;
}

export function toggleHabitCompletion(state, habitId, dateKey) {
  const cur = Array.isArray(state.completions[habitId]) ? [...state.completions[habitId]] : [];
  const i = cur.indexOf(dateKey);
  if (i >= 0) cur.splice(i, 1);
  else cur.push(dateKey);
  cur.sort();
  const next = {
    ...state,
    completions: { ...state.completions, [habitId]: cur },
  };
  saveRoutineState(next);
  return next;
}

export function setHabitArchived(state, id, archived) {
  return updateHabit(state, id, { archived: !!archived });
}

export function deleteHabit(state, id) {
  const completions = { ...state.completions };
  delete completions[id];
  const next = {
    ...state,
    habits: state.habits.filter((h) => h.id !== id),
    completions,
  };
  saveRoutineState(next);
  return next;
}

export function deleteTag(state, id) {
  const next = {
    ...state,
    tags: state.tags.filter((t) => t.id !== id),
    habits: state.habits.map((h) => ({
      ...h,
      tagIds: (h.tagIds || []).filter((x) => x !== id),
    })),
  };
  saveRoutineState(next);
  return next;
}
