/** Hub «Рутина»: звички, теги, категорії (не-спорт), localStorage */

import {
  dateKeyFromDate,
  habitScheduledOnDate,
} from "./hubCalendarAggregate.js";
import { completionNoteKey } from "./completionNoteKey.js";
import { createModuleStorage } from "@shared/lib/createModuleStorage.js";

const storage = createModuleStorage({ name: "routine" });

export const ROUTINE_STORAGE_KEY = "hub_routine_v1";

export const ROUTINE_EVENT = "hub-routine-storage";

/** Подія при невдалому localStorage.setItem (квота тощо) */
export const ROUTINE_STORAGE_ERROR = "hub-routine-storage-error";

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

function normalizeReminderTimesStorage(rt) {
  if (!Array.isArray(rt)) return [];
  return rt.filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Prune duplicates and invalid date keys from a single habit's completion list. */
function normalizeCompletionList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const v of list) {
    if (typeof v === "string" && DATE_KEY_RE.test(v)) seen.add(v);
  }
  return [...seen].sort();
}

/** Coerce the whole completions map into `{ [habitId]: sortedUniqueDateKeys }`. */
function normalizeCompletionsMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = normalizeCompletionList(v);
  }
  return out;
}

function normalizeHabit(h) {
  if (!h || typeof h !== "object") return h;
  const created = h.createdAt
    ? String(h.createdAt).slice(0, 10)
    : dateKeyFromDate(new Date());
  return {
    ...h,
    recurrence: h.recurrence || "daily",
    startDate: h.startDate || created,
    endDate: h.endDate === undefined ? null : h.endDate,
    timeOfDay: h.timeOfDay === undefined ? "" : String(h.timeOfDay),
    reminderTimes: normalizeReminderTimesStorage(h.reminderTimes),
    weekdays:
      Array.isArray(h.weekdays) && h.weekdays.length
        ? h.weekdays
        : [0, 1, 2, 3, 4, 5, 6],
  };
}

const defaultState = () => ({
  schemaVersion: 3,
  prefs: {
    showFizrukInCalendar: true,
    /** Планові списання підписок Фініка в календарі Hub */
    showFinykSubscriptionsInCalendar: true,
    /** Браузерні нагадування у вказаний час (якщо дозволено Notification) */
    routineRemindersEnabled: false,
  },
  tags: [],
  categories: [],
  habits: [],
  completions: {},
  /** "YYYY-MM-DD" -> кількість відтискань */
  pushupsByDate: {},
  /** порядок id активних звичок (drag/up-down) */
  habitOrder: [],
  /** completionNoteKey -> короткий текст */
  completionNotes: {},
});

function ensureHabitOrder(state) {
  const active = state.habits.filter((h) => !h.archived).map((h) => h.id);
  let order = [...(state.habitOrder || [])].filter((id) => active.includes(id));
  for (const id of active) {
    if (!order.includes(id)) order.push(id);
  }
  const same =
    order.length === (state.habitOrder || []).length &&
    order.every((id, i) => id === (state.habitOrder || [])[i]);
  if (same) return { state, changed: false };
  return { state: { ...state, habitOrder: order }, changed: true };
}

/**
 * Normalize habit order and persist if changed.
 * Legacy pushup migration is handled by storageManager (routine_001_migrate_fizruk_pushups)
 * which runs before the React tree mounts, so by the time this is called the migration is done.
 */
function finalizeLoadedRoutineState(state) {
  let s = state;
  const ord = ensureHabitOrder(s);
  s = ord.state;
  if (ord.changed) {
    saveRoutineState(s);
  }
  return s;
}

/**
 * Load and normalize the full routine state from localStorage.
 * Falls back to `defaultState()` on parse errors or missing key.
 * Applies one-time data finalization (e.g. legacy pushup migration).
 * @returns {{ schemaVersion: number, habits: Array, completions: Record<string,Record<string,boolean>>, tags: Array, categories: Array, prefs: object, pushupsByDate: Record<string,number>, habitOrder: string[], completionNotes: object }}
 */
export function loadRoutineState() {
  const p = storage.readJSON(ROUTINE_STORAGE_KEY, null);
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    return finalizeLoadedRoutineState(defaultState());
  }
  const merged = {
    ...defaultState(),
    ...p,
    prefs: { ...defaultState().prefs, ...(p.prefs || {}) },
    tags: Array.isArray(p.tags) ? p.tags : [],
    categories: Array.isArray(p.categories) ? p.categories : [],
    habits: Array.isArray(p.habits) ? p.habits.map(normalizeHabit) : [],
    completions: normalizeCompletionsMap(p.completions),
    pushupsByDate:
      typeof p.pushupsByDate === "object" && p.pushupsByDate
        ? p.pushupsByDate
        : {},
    habitOrder: Array.isArray(p.habitOrder) ? p.habitOrder : [],
    completionNotes:
      typeof p.completionNotes === "object" && p.completionNotes
        ? p.completionNotes
        : {},
  };
  return finalizeLoadedRoutineState(merged);
}

/**
 * Persist routine state to localStorage and dispatch a storage event.
 * @param {ReturnType<typeof loadRoutineState>} next - the new state to save
 * @returns {boolean} `true` on success, `false` if localStorage threw (e.g. quota exceeded)
 */
export function saveRoutineState(next) {
  const ok = storage.writeJSON(ROUTINE_STORAGE_KEY, next);
  if (ok) {
    emitRoutineStorage();
    return true;
  }
  try {
    window.dispatchEvent(
      new CustomEvent(ROUTINE_STORAGE_ERROR, {
        detail: { message: "save failed" },
      }),
    );
  } catch {
    /* noop */
  }
  return false;
}

export function createTag(state, name) {
  const n = (name || "").trim();
  if (!n) return state;
  const t = { id: uid("tag"), name: n, scope: "routine" };
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

/**
 * Create a new habit, append it to `state.habits`, persist, and return next state.
 * @param {ReturnType<typeof loadRoutineState>} state
 * @param {{ name: string, emoji?: string, tagIds?: string[], categoryId?: string|null, recurrence?: 'daily'|'weekly'|'custom', startDate?: string|null, endDate?: string|null, timeOfDay?: string, reminderTimes?: string[], weekdays?: number[] }} options
 * @returns {ReturnType<typeof loadRoutineState>} Updated state (or original state if `name` is empty).
 */
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
    reminderTimes = [],
    weekdays = [0, 1, 2, 3, 4, 5, 6],
  } = {},
) {
  const n = (name || "").trim();
  if (!n) return state;
  const sd =
    (startDate && String(startDate).trim()) || dateKeyFromDate(new Date());
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
    timeOfDay:
      timeOfDay && String(timeOfDay).trim()
        ? String(timeOfDay).trim().slice(0, 5)
        : "",
    reminderTimes: normalizeReminderTimesStorage(reminderTimes),
    weekdays: Array.isArray(weekdays)
      ? [...new Set(weekdays)].sort((a, b) => a - b)
      : [0, 1, 2, 3, 4, 5, 6],
  });
  const order = [...(state.habitOrder || []), h.id];
  const next = {
    ...state,
    habits: [...state.habits, h],
    completions: { ...state.completions },
    habitOrder: order,
  };
  saveRoutineState(next);
  return next;
}

/**
 * Apply a partial patch to a habit by id, persist, and return next state.
 * @param {ReturnType<typeof loadRoutineState>} state
 * @param {string} id - habit id
 * @param {Partial<ReturnType<typeof loadRoutineState>['habits'][0]>} patch
 * @returns {ReturnType<typeof loadRoutineState>}
 */
export function updateHabit(state, id, patch) {
  const next = {
    ...state,
    habits: state.habits.map((h) =>
      h.id === id ? normalizeHabit({ ...h, ...patch }) : h,
    ),
  };
  saveRoutineState(next);
  return next;
}

export function setPref(state, key, value) {
  const next = { ...state, prefs: { ...state.prefs, [key]: value } };
  saveRoutineState(next);
  return next;
}

/**
 * Toggle a habit's completion for a given date.
 * No-op if the habit is not scheduled on that date (and it wasn't already marked).
 * @param {ReturnType<typeof loadRoutineState>} state
 * @param {string} habitId
 * @param {string} dateKey - ISO date string "YYYY-MM-DD"
 * @returns {ReturnType<typeof loadRoutineState>}
 */
export function toggleHabitCompletion(state, habitId, dateKey) {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return state;
  const curSet = new Set(normalizeCompletionList(state.completions[habitId]));
  if (curSet.has(dateKey)) {
    curSet.delete(dateKey);
  } else {
    if (!habitScheduledOnDate(habit, dateKey)) return state;
    curSet.add(dateKey);
  }
  const cur = [...curSet].sort();
  const next = {
    ...state,
    completions: { ...state.completions, [habitId]: cur },
  };
  saveRoutineState(next);
  return next;
}

/** Усі активні звички, заплановані на день, отримують відмітку (якщо ще немає). */
export function markAllScheduledHabitsComplete(state, dateKey) {
  const active = state.habits.filter((h) => !h.archived);
  const completions = { ...state.completions };
  let changed = false;
  for (const h of active) {
    if (!habitScheduledOnDate(h, dateKey)) continue;
    const set = new Set(normalizeCompletionList(completions[h.id]));
    if (set.has(dateKey)) continue;
    set.add(dateKey);
    completions[h.id] = [...set].sort();
    changed = true;
  }
  if (!changed) return state;
  const next = { ...state, completions };
  saveRoutineState(next);
  return next;
}

export function setHabitArchived(state, id, archived) {
  return updateHabit(state, id, { archived: !!archived });
}

export function deleteHabit(state, id) {
  const completions = { ...state.completions };
  delete completions[id];
  const notes = { ...(state.completionNotes || {}) };
  const prefix = `${id}__`;
  for (const k of Object.keys(notes)) {
    if (k.startsWith(prefix)) delete notes[k];
  }
  const next = {
    ...state,
    habits: state.habits.filter((h) => h.id !== id),
    completions,
    completionNotes: notes,
    habitOrder: (state.habitOrder || []).filter((x) => x !== id),
  };
  saveRoutineState(next);
  return next;
}

export function addPushupReps(state, reps) {
  const n = Number(reps);
  if (!n || n <= 0) return state;
  const today = dateKeyFromDate(new Date());
  const cur = state.pushupsByDate?.[today] ?? 0;
  const next = {
    ...state,
    pushupsByDate: { ...state.pushupsByDate, [today]: cur + n },
  };
  saveRoutineState(next);
  return next;
}

export function moveHabitInOrder(state, habitId, delta) {
  const active = state.habits.filter((h) => !h.archived).map((h) => h.id);
  let order = [...(state.habitOrder || [])].filter((id) => active.includes(id));
  for (const id of active) {
    if (!order.includes(id)) order.push(id);
  }
  const i = order.indexOf(habitId);
  if (i < 0) return state;
  const j = i + delta;
  if (j < 0 || j >= order.length) return state;
  const copy = [...order];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  const next = { ...state, habitOrder: copy };
  saveRoutineState(next);
  return next;
}

/** Повний порядок активних звичок (наприклад після drag-and-drop) */
export function setHabitOrder(state, orderedActiveIds) {
  const active = state.habits.filter((h) => !h.archived).map((h) => h.id);
  const seen = new Set();
  const order = [];
  for (const id of orderedActiveIds) {
    if (active.includes(id) && !seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  for (const id of active) {
    if (!seen.has(id)) order.push(id);
  }
  const next = { ...state, habitOrder: order };
  saveRoutineState(next);
  return next;
}

export function setCompletionNote(state, habitId, dateKey, text) {
  const k = completionNoteKey(habitId, dateKey);
  const notes = { ...(state.completionNotes || {}) };
  const t = (text || "").trim();
  if (!t) {
    if (!(k in notes)) return state;
    delete notes[k];
  } else {
    const habitExists = state.habits.some((h) => h.id === habitId);
    if (!habitExists) return state;
    notes[k] = t.slice(0, 500);
  }
  const next = { ...state, completionNotes: notes };
  saveRoutineState(next);
  return next;
}

/**
 * Build a JSON-serializable backup payload for the Routine module.
 * @returns {{ kind: 'hub-routine-backup', schemaVersion: number, exportedAt: string, data: ReturnType<typeof loadRoutineState> }}
 */
export function buildRoutineBackupPayload() {
  return {
    kind: "hub-routine-backup",
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    data: loadRoutineState(),
  };
}

export function applyRoutineBackupPayload(parsed) {
  if (
    !parsed ||
    parsed.kind !== "hub-routine-backup" ||
    !parsed.data ||
    typeof parsed.data !== "object"
  ) {
    throw new Error("Некоректний файл резервної копії Рутини.");
  }
  const d = parsed.data;
  const merged = {
    ...defaultState(),
    ...d,
    prefs: { ...defaultState().prefs, ...(d.prefs || {}) },
    tags: Array.isArray(d.tags) ? d.tags : [],
    categories: Array.isArray(d.categories) ? d.categories : [],
    habits: Array.isArray(d.habits) ? d.habits.map(normalizeHabit) : [],
    completions: normalizeCompletionsMap(d.completions),
    pushupsByDate:
      typeof d.pushupsByDate === "object" && d.pushupsByDate
        ? d.pushupsByDate
        : {},
    habitOrder: Array.isArray(d.habitOrder) ? d.habitOrder : [],
    completionNotes:
      typeof d.completionNotes === "object" && d.completionNotes
        ? d.completionNotes
        : {},
  };
  let s = merged;
  s = ensureHabitOrder(s).state;
  if (!saveRoutineState(s)) {
    throw new Error(
      "Не вдалося записати дані після імпорту (наприклад, переповнення сховища).",
    );
  }
}

export function updateTag(state, id, newName) {
  const n = (newName || "").trim();
  if (!n) return state;
  const next = {
    ...state,
    tags: state.tags.map((t) => (t.id === id ? { ...t, name: n } : t)),
  };
  saveRoutineState(next);
  return next;
}

export function updateCategory(state, id, patch) {
  const next = {
    ...state,
    categories: state.categories.map((c) =>
      c.id === id
        ? {
            ...c,
            ...(patch.name !== undefined
              ? { name: (patch.name || "").trim() || c.name }
              : {}),
            ...(patch.emoji !== undefined
              ? { emoji: patch.emoji || undefined }
              : {}),
          }
        : c,
    ),
  };
  saveRoutineState(next);
  return next;
}

export function deleteCategory(state, id) {
  const next = {
    ...state,
    categories: state.categories.filter((c) => c.id !== id),
    habits: state.habits.map((h) =>
      h.categoryId === id ? { ...h, categoryId: null } : h,
    ),
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
