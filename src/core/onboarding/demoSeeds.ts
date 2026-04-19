// Unified demo-data seed for the FTUX "instant value" moment.
//
// When a new user picks a "vibe" (one or more modules), we seed ~2 weeks of
// realistic-but-obviously-fake data into the matching localStorage keys so
// the dashboard renders populated cards within a few hundred ms — no API
// calls, no typing. Every seeder is **idempotent** and will not overwrite
// existing user data; if we see real data for a module we silently skip it.
//
// Seeded data is marked with the flag below so the UI can surface a subtle
// "demo" pill and replace each card's values with real numbers the moment
// the user logs something of their own.

import {
  seedFinykDemoData,
  enableFinykManualOnly,
} from "../../modules/finyk/lib/demoData.js";

const DEMO_SEEDED_FLAG_KEY = "hub_demo_seeded_v1";

const FIZRUK_WORKOUTS_KEY = "fizruk_workouts_v1";
const ROUTINE_STATE_KEY = "hub_routine_v1";
const NUTRITION_LOG_KEY = "nutrition_log_v1";

function safeReadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Fizruk ──────────────────────────────────────────────────────────────

const FIZRUK_DEMO_WORKOUTS = [
  { offset: 1, name: "Верх тіла", durationMin: 42, exercises: 5 },
  { offset: 3, name: "Ноги + кор", durationMin: 38, exercises: 4 },
  { offset: 5, name: "Кардіо", durationMin: 25, exercises: 2 },
  { offset: 8, name: "Верх тіла", durationMin: 45, exercises: 6 },
  { offset: 11, name: "Ноги + кор", durationMin: 40, exercises: 5 },
];

function seedFizrukDemoData() {
  const existing = safeReadJSON(FIZRUK_WORKOUTS_KEY, null);
  const existingArr = Array.isArray(existing)
    ? existing
    : existing && Array.isArray(existing.workouts)
      ? existing.workouts
      : [];
  if (existingArr.length > 0) return 0;

  const workouts = FIZRUK_DEMO_WORKOUTS.map((w) => {
    const finishedAt = daysAgo(w.offset);
    const startedAt = new Date(finishedAt.getTime() - w.durationMin * 60000);
    return {
      id: `demo-wo-${finishedAt.getTime()}`,
      demo: true,
      name: w.name,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSec: w.durationMin * 60,
      exercises: Array.from({ length: w.exercises }).map((_, i) => ({
        id: `demo-ex-${finishedAt.getTime()}-${i}`,
        name: "Вправа",
        sets: [
          { reps: 10, weight: 10, done: true },
          { reps: 10, weight: 10, done: true },
          { reps: 8, weight: 12, done: true },
        ],
      })),
    };
  });

  return safeWriteJSON(FIZRUK_WORKOUTS_KEY, {
    schemaVersion: 1,
    workouts,
  })
    ? workouts.length
    : 0;
}

// ─── Routine (habits + completions) ──────────────────────────────────────

const ROUTINE_DEMO_HABITS = [
  { name: "Випити воду", emoji: "💧" },
  { name: "10 хв читання", emoji: "📖" },
  { name: "Прогулянка", emoji: "🚶" },
];

function seedRoutineDemoData() {
  const existing = safeReadJSON(ROUTINE_STATE_KEY, null);
  if (
    existing &&
    Array.isArray(existing.habits) &&
    existing.habits.length > 0
  ) {
    return 0;
  }

  const createdAt = toLocalISODate(daysAgo(14));
  const habits = ROUTINE_DEMO_HABITS.map((h, i) => ({
    id: `demo-habit-${i}-${Date.now()}`,
    demo: true,
    name: `${h.emoji} ${h.name}`,
    recurrence: "daily",
    startDate: createdAt,
    endDate: null,
    timeOfDay: "",
    reminderTimes: [],
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    createdAt,
  }));

  // Mark most days complete for habit 0 ("water") so streak + heatmap
  // both light up immediately. Thinner pattern on the other two keeps
  // the lead/laggard charts looking meaningful.
  const completions = {};
  for (let i = 0; i < habits.length; i++) {
    const habit = habits[i];
    const density = i === 0 ? 13 : i === 1 ? 9 : 6;
    const dates = [];
    for (let d = 0; d < density; d++) {
      dates.push(toLocalISODate(daysAgo(d)));
    }
    completions[habit.id] = dates;
  }

  const next = {
    schemaVersion: 3,
    prefs: {
      showFizrukInCalendar: true,
      showFinykSubscriptionsInCalendar: true,
      routineRemindersEnabled: false,
    },
    tags: [],
    categories: [],
    habits,
    completions,
    pushupsByDate: {},
    habitOrder: habits.map((h) => h.id),
    completionNotes: {},
  };

  return safeWriteJSON(ROUTINE_STATE_KEY, next) ? habits.length : 0;
}

// ─── Nutrition (meal log) ────────────────────────────────────────────────

const NUTRITION_DEMO_MEALS = [
  { offset: 0, meal: "breakfast", name: "Омлет з авокадо", kcal: 420 },
  { offset: 0, meal: "lunch", name: "Куряча грудка + рис", kcal: 580 },
  { offset: 1, meal: "breakfast", name: "Вівсянка з ягодами", kcal: 380 },
  { offset: 1, meal: "dinner", name: "Лосось з овочами", kcal: 520 },
  { offset: 2, meal: "lunch", name: "Паста болоньєзе", kcal: 640 },
  { offset: 3, meal: "snack", name: "Банан + горіхи", kcal: 280 },
  { offset: 4, meal: "dinner", name: "Салат Цезар", kcal: 450 },
];

function seedNutritionDemoData() {
  const existing = safeReadJSON(NUTRITION_LOG_KEY, null);
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    if (Object.keys(existing).length > 0) return 0;
  }

  // Rough macro split that's close enough to a real meal for the rings
  // and daily totals to render convincingly.
  const splitMacros = (kcal) => ({
    kcal,
    protein_g: Math.round((kcal * 0.22) / 4),
    fat_g: Math.round((kcal * 0.28) / 9),
    carbs_g: Math.round((kcal * 0.5) / 4),
  });

  const log = {};
  for (const m of NUTRITION_DEMO_MEALS) {
    const dateKey = toLocalISODate(daysAgo(m.offset));
    // IMPORTANT: `normalizeNutritionLog` reads each day as `{ meals: [] }`;
    // any other shape (e.g. `{ items: [] }`) is silently dropped on load.
    if (!log[dateKey]) log[dateKey] = { meals: [] };
    log[dateKey].meals.push({
      id: `demo-meal-${dateKey}-${log[dateKey].meals.length}`,
      demo: true,
      name: m.name,
      mealType: m.meal,
      source: "manual",
      macros: splitMacros(m.kcal),
    });
  }

  return safeWriteJSON(NUTRITION_LOG_KEY, log)
    ? NUTRITION_DEMO_MEALS.length
    : 0;
}

// ─── Public API ──────────────────────────────────────────────────────────

const SEEDERS = {
  finyk: () => {
    enableFinykManualOnly();
    return seedFinykDemoData();
  },
  fizruk: seedFizrukDemoData,
  routine: seedRoutineDemoData,
  nutrition: seedNutritionDemoData,
};

/**
 * Seed demo data for every module the user picked during onboarding.
 * Idempotent — skips modules that already have real data. Returns a map
 * of module id → count of entries seeded (0 for skipped/failed modules).
 *
 * @param {Array<"finyk"|"fizruk"|"routine"|"nutrition">} moduleIds
 */
export function seedDemoForModules(moduleIds) {
  const result = {};
  for (const id of moduleIds || []) {
    const seeder = SEEDERS[id];
    if (!seeder) continue;
    try {
      result[id] = seeder();
    } catch {
      result[id] = 0;
    }
  }
  try {
    localStorage.setItem(DEMO_SEEDED_FLAG_KEY, "1");
  } catch {
    /* noop */
  }
  return result;
}

export function wasDemoSeeded() {
  try {
    return localStorage.getItem(DEMO_SEEDED_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
