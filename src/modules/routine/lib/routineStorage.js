/** Hub «Рутина»: звички, теги, категорії (не-спорт), localStorage */

import { dateKeyFromDate } from "./hubCalendarAggregate.js";
import { completionNoteKey } from "./completionNoteKey.js";

export const ROUTINE_STORAGE_KEY = "hub_routine_v1";

/** Легасі Фізрука — одноразова міграція відтискань у Рутину */
const FIZRUK_PUSHUPS_LEGACY = "fizruk_pushups_v1";

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
  schemaVersion: 3,
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
  /** "YYYY-MM-DD" -> кількість відтискань */
  pushupsByDate: {},
  /** порядок id активних звичок (drag/up-down) */
  habitOrder: [],
  /** completionNoteKey -> короткий текст */
  completionNotes: {},
});

function migrateLegacyPushups(state) {
  const cur = state.pushupsByDate && typeof state.pushupsByDate === "object" ? state.pushupsByDate : {};
  if (Object.keys(cur).length > 0) return { state, migrated: false };
  try {
    const raw = localStorage.getItem(FIZRUK_PUSHUPS_LEGACY);
    if (!raw) return { state, migrated: false };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed || Object.keys(parsed).length === 0) {
      return { state, migrated: false };
    }
    return { state: { ...state, pushupsByDate: { ...parsed } }, migrated: true };
  } catch {
    return { state, migrated: false };
  }
}

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

/** Міграція з легасі, нормалізація порядку звичок, збереження якщо щось змінилось */
function finalizeLoadedRoutineState(state) {
  let s = state;
  const mig = migrateLegacyPushups(s);
  s = mig.state;
  const ord = ensureHabitOrder(s);
  s = ord.state;
  if (mig.migrated || ord.changed) {
    saveRoutineState(s);
  }
  if (mig.migrated) {
    try {
      localStorage.removeItem(FIZRUK_PUSHUPS_LEGACY);
    } catch {
      /* noop */
    }
  }
  return s;
}

export function loadRoutineState() {
  try {
    const raw = localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (!raw) {
      return finalizeLoadedRoutineState(defaultState());
    }
    const p = JSON.parse(raw);
    const merged = {
      ...defaultState(),
      ...p,
      prefs: { ...defaultState().prefs, ...(p.prefs || {}) },
      tags: Array.isArray(p.tags) ? p.tags : [],
      categories: Array.isArray(p.categories) ? p.categories : [],
      habits: Array.isArray(p.habits) ? p.habits.map(normalizeHabit) : [],
      completions: typeof p.completions === "object" && p.completions ? p.completions : {},
      pushupsByDate:
        typeof p.pushupsByDate === "object" && p.pushupsByDate ? p.pushupsByDate : {},
      habitOrder: Array.isArray(p.habitOrder) ? p.habitOrder : [],
      completionNotes:
        typeof p.completionNotes === "object" && p.completionNotes ? p.completionNotes : {},
    };
    return finalizeLoadedRoutineState(merged);
  } catch {
    return finalizeLoadedRoutineState(defaultState());
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
  const order = [...(state.habitOrder || []), h.id];
  const next = { ...state, habits: [...state.habits, h], completions: { ...state.completions }, habitOrder: order };
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

export function setCompletionNote(state, habitId, dateKey, text) {
  const k = completionNoteKey(habitId, dateKey);
  const notes = { ...(state.completionNotes || {}) };
  const t = (text || "").trim();
  if (!t) delete notes[k];
  else notes[k] = t.slice(0, 500);
  const next = { ...state, completionNotes: notes };
  saveRoutineState(next);
  return next;
}

export function buildRoutineBackupPayload() {
  return {
    kind: "hub-routine-backup",
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    data: loadRoutineState(),
  };
}

export function applyRoutineBackupPayload(parsed) {
  if (!parsed || parsed.kind !== "hub-routine-backup" || !parsed.data || typeof parsed.data !== "object") {
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
    completions: typeof d.completions === "object" && d.completions ? d.completions : {},
    pushupsByDate: typeof d.pushupsByDate === "object" && d.pushupsByDate ? d.pushupsByDate : {},
    habitOrder: Array.isArray(d.habitOrder) ? d.habitOrder : [],
    completionNotes: typeof d.completionNotes === "object" && d.completionNotes ? d.completionNotes : {},
  };
  let s = merged;
  const mig = migrateLegacyPushups(s);
  s = mig.state;
  s = ensureHabitOrder(s).state;
  saveRoutineState(s);
  if (mig.migrated) {
    try {
      localStorage.removeItem(FIZRUK_PUSHUPS_LEGACY);
    } catch {
      /* noop */
    }
  }
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
