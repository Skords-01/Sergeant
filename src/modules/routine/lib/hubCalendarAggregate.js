import {
  MONTHLY_PLAN_STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
} from "../../fizruk/lib/fizrukStorage.js";
import { sortHabitsByOrder } from "./habitOrder.js";
import { completionNoteKey } from "./completionNoteKey.js";

export const FIZRUK_GROUP_LABEL = "Фізрук";

function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadMonthlyPlanDays() {
  try {
    const raw = localStorage.getItem(MONTHLY_PLAN_STORAGE_KEY);
    if (!raw) return {};
    const p = safeParse(raw, {});
    return typeof p.days === "object" && p.days ? p.days : {};
  } catch {
    return {};
  }
}

export function loadTemplateNameById() {
  const map = new Map();
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    const arr = raw ? safeParse(raw, []) : [];
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (t?.id && t?.name) map.set(t.id, String(t.name));
      }
    }
  } catch {
    /* noop */
  }
  return map;
}

export function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(key) {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

export function enumerateDateKeys(startKey, endKey) {
  const out = [];
  const d = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  d.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  while (d <= end) {
    out.push(dateKeyFromDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Пн=0 … Нд=6 */
function isoWeekdayFromDateKey(dateKey) {
  const d = parseDateKey(dateKey);
  return (d.getDay() + 6) % 7;
}

/** Чи потрапляє звичка на цей день згідно з датами та регулярністю */
export function habitScheduledOnDate(habit, dateKey) {
  if (habit.archived) return false;
  const start = habit.startDate || (habit.createdAt ? String(habit.createdAt).slice(0, 10) : dateKey);
  const end = habit.endDate || null;
  if (dateKey < start) return false;
  if (end && dateKey > end) return false;
  const r = habit.recurrence || "daily";
  if (r === "once") return dateKey === start;
  if (r === "daily") return true;
  if (r === "weekdays") {
    const wd = isoWeekdayFromDateKey(dateKey);
    return wd >= 0 && wd <= 4;
  }
  if (r === "weekly") {
    const days =
      Array.isArray(habit.weekdays) && habit.weekdays.length > 0
        ? habit.weekdays
        : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(isoWeekdayFromDateKey(dateKey));
  }
  if (r === "monthly") {
    const anchorDom = parseDateKey(start).getDate();
    const d = parseDateKey(dateKey);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const scheduledDay = Math.min(anchorDom, daysInMonth);
    return d.getDate() === scheduledDay;
  }
  return true;
}

function tagLabelsForHabit(state, habit) {
  const ids = habit.tagIds || [];
  const labels = ids
    .map((id) => state.tags.find((t) => t.id === id)?.name)
    .filter(Boolean);
  if (habit.categoryId) {
    const c = state.categories.find((x) => x.id === habit.categoryId);
    if (c?.name) labels.push(c.name);
  }
  return labels.length ? labels : ["Без тегу"];
}

export function buildHubCalendarEvents(state, range, { showFizruk = true } = {}) {
  const events = [];
  const { startKey, endKey } = range;
  const days = enumerateDateKeys(startKey, endKey);
  const planDays = loadMonthlyPlanDays();
  const tplNames = loadTemplateNameById();

  if (showFizruk) {
    for (const date of days) {
      const tid = planDays[date]?.templateId;
      if (!tid) continue;
      const title = tplNames.get(tid) || "Тренування за планом";
      events.push({
        id: `fizruk_${date}_${tid}`,
        source: "fizruk_plan",
        date,
        title,
        subtitle: "План Фізрука",
        tagLabels: [FIZRUK_GROUP_LABEL],
        sortKey: `${date} 0 fizruk`,
        fizruk: true,
        sourceKind: "fizruk",
      });
    }
  }

  const notes = state.completionNotes && typeof state.completionNotes === "object" ? state.completionNotes : {};
  const activeHabits = sortHabitsByOrder(
    state.habits.filter((h) => !h.archived),
    state.habitOrder || [],
  );
  for (const date of days) {
    for (const h of activeHabits) {
      if (!habitScheduledOnDate(h, date)) continue;
      const completions = state.completions[h.id] || [];
      const completed = completions.includes(date);
      const tagLabels = tagLabelsForHabit(state, h);
      const t = h.timeOfDay ? String(h.timeOfDay).trim() : "";
      const timePart = t ? ` · ${t}` : "";
      const nk = completionNoteKey(h.id, date);
      const note = notes[nk] ? String(notes[nk]) : "";
      events.push({
        id: `habit_${h.id}_${date}`,
        source: "routine_habit",
        date,
        title: `${h.emoji} ${h.name}`,
        subtitle: completed ? `Зроблено${timePart}` : `Звичка${timePart}`,
        tagLabels,
        sortKey: `${date} 1 ${h.name}`,
        habitId: h.id,
        completed,
        note,
        sourceKind: "habit",
      });
    }
  }

  events.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "uk"));
  return events;
}

export function countEventsByDate(events) {
  const map = new Map();
  for (const e of events) {
    map.set(e.date, (map.get(e.date) || 0) + 1);
  }
  return map;
}
