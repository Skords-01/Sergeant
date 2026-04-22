// One-shot demo-mode seeder. Activated by `?demo=1` (or `?demo=seed`)
// on any URL — populates localStorage with realistic sample data
// across all four modules (Finyk / Fizruk / Routine / Nutrition),
// skips the onboarding splash + Finyk bank-login gate, then reloads
// onto `/` so the app renders against the seeded state.
//
// `?demo=reset` clears the seeded keys back to a cold-start state.
//
// Implementation note: the "cleanup" pass in `cleanupDemoData.ts`
// strips anything flagged `demo: true` once per device. This seeder
// writes data WITHOUT that flag (otherwise the cleanup would nuke it
// on the very next boot) and pre-sets the cleanup-done marker so any
// legacy demo-flagged payload from earlier builds is also left alone.
//
// Intended for marketing screenshots / social-media captures — the
// module is tiny, synchronous and safe to call from `main.jsx` before
// React hydrates.

const DEMO_FLAG_KEY = "hub_demo_seeded_social_v1";
const DEMO_CLEANUP_DONE_KEY = "hub_demo_cleanup_v1_done";
const ONBOARDING_DONE_KEY = "hub_onboarding_done_v1";
const FIRST_REAL_ENTRY_KEY = "hub_first_real_entry_v1";
const FINYK_MANUAL_ONLY_KEY = "finyk_manual_only_v1";

// Module storage keys — kept inline so this file has no cross-module
// import cycle via the onboarding barrel. If any of these ever rename,
// the seeder silently stops populating that module, which is the
// desired failure mode (better than crashing on boot).
const FINYK_MANUAL_EXPENSES_KEY = "finyk_manual_expenses_v1";
const FINYK_CUSTOM_CATS_KEY = "finyk_custom_cats_v1";
const FINYK_MONTHLY_PLAN_KEY = "finyk_monthly_plan";
const FIZRUK_WORKOUTS_KEY = "fizruk_workouts_v1";
const FIZRUK_MEASUREMENTS_KEY = "fizruk_measurements_v1";
const ROUTINE_STATE_KEY = "hub_routine_v1";
const NUTRITION_LOG_KEY = "nutrition_log_v1";
const NUTRITION_PREFS_KEY = "nutrition_prefs_v1";

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop — private mode / quota — nothing else to do on a demo path */
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function toISO(d: Date): string {
  return d.toISOString();
}

function dateKey(d: Date): string {
  // YYYY-MM-DD in local time — matches nutrition/routine persistence.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number, hour = 12, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function shortId(prefix: string, seed: number): string {
  return `${prefix}_${seed.toString(36)}`;
}

// ──────────────────────────────────────────────────────────────────
// module seeds
// ──────────────────────────────────────────────────────────────────

interface ManualExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

function seedFinyk(): void {
  // Manual expenses — mix of categories spread over the last 14 days.
  // Shape matches `addManualExpense` in `useStorage.ts`:
  //   { id, date, description, amount, category }
  const spec: Array<
    Omit<ManualExpense, "id" | "date"> & { d: number; h: number }
  > = [
    { d: 0, h: 9, amount: 145, category: "food", description: "Сільпо" },
    {
      d: 0,
      h: 13,
      amount: 220,
      category: "restaurant",
      description: "Піца Celentano",
    },
    { d: 0, h: 18, amount: 85, category: "transport", description: "Bolt" },
    { d: 1, h: 10, amount: 390, category: "food", description: "АТБ" },
    {
      d: 1,
      h: 20,
      amount: 199,
      category: "subscriptions",
      description: "Netflix",
    },
    { d: 2, h: 12, amount: 60, category: "transport", description: "Метро" },
    {
      d: 2,
      h: 19,
      amount: 450,
      category: "restaurant",
      description: "Вечеря з друзями",
    },
    { d: 3, h: 11, amount: 1200, category: "shopping", description: "Rozetka" },
    { d: 4, h: 8, amount: 35, category: "food", description: "Кава" },
    { d: 4, h: 17, amount: 980, category: "health", description: "Аптека" },
    { d: 5, h: 14, amount: 550, category: "food", description: "Сільпо" },
    { d: 6, h: 13, amount: 320, category: "restaurant", description: "Суші" },
    {
      d: 7,
      h: 10,
      amount: 180,
      category: "transport",
      description: "Заправка WOG",
    },
    {
      d: 7,
      h: 21,
      amount: 129,
      category: "subscriptions",
      description: "Spotify",
    },
    { d: 8, h: 15, amount: 720, category: "shopping", description: "Zara" },
    { d: 9, h: 9, amount: 95, category: "food", description: "Ранок, випічка" },
    {
      d: 10,
      h: 18,
      amount: 410,
      category: "entertainment",
      description: "Кіно",
    },
    { d: 11, h: 12, amount: 260, category: "food", description: "Новус" },
    {
      d: 12,
      h: 19,
      amount: 150,
      category: "restaurant",
      description: "Кав'ярня",
    },
    { d: 13, h: 16, amount: 85, category: "transport", description: "Uber" },
  ];

  const transactions: ManualExpense[] = spec.map((s, i) => ({
    id: shortId("demo_fx", 1700 + i),
    date: toISO(daysAgo(s.d, s.h, 0)),
    description: s.description,
    amount: s.amount,
    category: s.category,
  }));
  writeJSON(FINYK_MANUAL_EXPENSES_KEY, transactions);

  // Leave custom categories empty — MCC base set covers the seeded
  // expenses and gives the pie-chart enough variety out of the box.
  writeJSON(FINYK_CUSTOM_CATS_KEY, []);

  // Monthly plan so the "бюджет vs факт" cards render with a target
  // instead of the "додай план" empty-state.
  writeJSON(FINYK_MONTHLY_PLAN_KEY, { income: 45000, expense: 28000 });

  // Skip the Monobank-login gate so Finyk renders its full UI.
  writeRaw(FINYK_MANUAL_ONLY_KEY, "1");
}

function seedFizruk(): void {
  // A single finished workout 2 days ago — enough for the calendar
  // streak, the recovery map, and "останнє тренування" card to light
  // up. Shape mirrors what `FinishWorkoutSheet` persists: a workout
  // item per exercise with `type: "strength"` and populated `sets`.
  const startedAt = daysAgo(2, 18, 30);
  const endedAt = new Date(startedAt.getTime() + 55 * 60 * 1000);

  const workouts = [
    {
      id: shortId("demo_wo", 1),
      startedAt: toISO(startedAt),
      endedAt: toISO(endedAt),
      note: "",
      warmup: null,
      cooldown: null,
      groups: [],
      items: [
        {
          id: shortId("demo_wi", 1),
          exerciseId: "squat",
          nameUk: "Присідання зі штангою",
          primaryGroup: "legs",
          musclesPrimary: ["quads"],
          musclesSecondary: ["glutes", "core"],
          type: "strength",
          sets: [
            { weightKg: 60, reps: 10 },
            { weightKg: 70, reps: 8 },
            { weightKg: 80, reps: 6 },
            { weightKg: 80, reps: 6 },
          ],
        },
        {
          id: shortId("demo_wi", 2),
          exerciseId: "bench_press",
          nameUk: "Жим штанги лежачи",
          primaryGroup: "chest",
          musclesPrimary: ["chest"],
          musclesSecondary: ["triceps", "shoulders"],
          type: "strength",
          sets: [
            { weightKg: 40, reps: 12 },
            { weightKg: 50, reps: 10 },
            { weightKg: 60, reps: 8 },
          ],
        },
        {
          id: shortId("demo_wi", 3),
          exerciseId: "deadlift",
          nameUk: "Станова тяга",
          primaryGroup: "back",
          musclesPrimary: ["back", "hamstrings"],
          musclesSecondary: ["glutes", "forearms"],
          type: "strength",
          sets: [
            { weightKg: 80, reps: 8 },
            { weightKg: 100, reps: 5 },
            { weightKg: 100, reps: 5 },
          ],
        },
      ],
    },
    {
      id: shortId("demo_wo", 2),
      startedAt: toISO(daysAgo(5, 19, 0)),
      endedAt: toISO(daysAgo(5, 19, 50)),
      note: "",
      warmup: null,
      cooldown: null,
      groups: [],
      items: [
        {
          id: shortId("demo_wi", 10),
          exerciseId: "pullup",
          nameUk: "Підтягування",
          primaryGroup: "back",
          musclesPrimary: ["back", "biceps"],
          musclesSecondary: ["forearms"],
          type: "strength",
          sets: [
            { weightKg: 0, reps: 8 },
            { weightKg: 0, reps: 7 },
            { weightKg: 0, reps: 6 },
          ],
        },
        {
          id: shortId("demo_wi", 11),
          exerciseId: "ohp",
          nameUk: "Армійський жим",
          primaryGroup: "shoulders",
          musclesPrimary: ["shoulders"],
          musclesSecondary: ["triceps"],
          type: "strength",
          sets: [
            { weightKg: 30, reps: 10 },
            { weightKg: 35, reps: 8 },
            { weightKg: 35, reps: 8 },
          ],
        },
      ],
    },
  ];

  writeJSON(FIZRUK_WORKOUTS_KEY, { schemaVersion: 1, workouts });

  // One recent measurement row so «Виміри» is populated.
  writeJSON(FIZRUK_MEASUREMENTS_KEY, [
    {
      id: shortId("demo_m", 1),
      at: toISO(daysAgo(1, 8, 0)),
      weight: 78.4,
      waist: 82,
      chest: 100,
    },
  ]);
}

function seedRoutine(): void {
  // 5 habits + a week of completions → streaks, heatmap, and the
  // «сьогодні» slot all render populated.
  const today = new Date();

  const habits = [
    {
      id: shortId("demo_h", 1),
      name: "Випити 2 л води",
      emoji: "💧",
      recurrence: "daily",
      createdAt: toISO(daysAgo(30)),
      tagIds: [],
      archived: false,
    },
    {
      id: shortId("demo_h", 2),
      name: "Читати 20 хвилин",
      emoji: "📚",
      recurrence: "daily",
      createdAt: toISO(daysAgo(30)),
      tagIds: [],
      archived: false,
    },
    {
      id: shortId("demo_h", 3),
      name: "Медитація",
      emoji: "🧘",
      recurrence: "daily",
      createdAt: toISO(daysAgo(30)),
      tagIds: [],
      archived: false,
    },
    {
      id: shortId("demo_h", 4),
      name: "10 000 кроків",
      emoji: "🚶",
      recurrence: "daily",
      createdAt: toISO(daysAgo(30)),
      tagIds: [],
      archived: false,
    },
    {
      id: shortId("demo_h", 5),
      name: "Без цукру",
      emoji: "🍬",
      recurrence: "daily",
      createdAt: toISO(daysAgo(30)),
      tagIds: [],
      archived: false,
    },
  ];

  // Completions: build a healthy-looking 14-day history. Each habit
  // completes on most days so the user sees real streaks in the UI.
  const completions: Record<string, string[]> = {};
  for (const habit of habits) {
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      // Skip one day per habit to keep streaks varied but non-zero.
      if (i === 3 && habit.id.endsWith("_2")) continue;
      if (i === 5 && habit.id.endsWith("_4")) continue;
      if (i === 7 && habit.id.endsWith("_5")) continue;
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(dateKey(d));
    }
    completions[habit.id] = dates;
  }

  // 14 days of push-ups to populate «Віджимання дня» widget.
  const pushupsByDate: Record<string, number> = {};
  const pushupPlan = [25, 30, 28, 35, 40, 30, 32, 45, 50, 42, 38, 40, 55, 48];
  for (let i = 0; i < pushupPlan.length; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    pushupsByDate[dateKey(d)] = pushupPlan[i];
  }

  const state = {
    schemaVersion: 1,
    prefs: {
      showFizrukInCalendar: true,
      showFinykSubscriptionsInCalendar: true,
      routineRemindersEnabled: false,
    },
    tags: [],
    categories: [],
    habits,
    completions,
    pushupsByDate,
    habitOrder: habits.map((h) => h.id),
    completionNotes: {},
  };

  writeJSON(ROUTINE_STATE_KEY, state);
}

function seedNutrition(): void {
  const today = dateKey(new Date());
  const yesterday = dateKey(daysAgo(1));

  const meal = (
    seed: number,
    time: string,
    label: string,
    name: string,
    kcal: number,
    protein: number,
    fat: number,
    carbs: number,
    mealType: "breakfast" | "lunch" | "dinner" | "snack",
  ) => ({
    id: shortId("demo_meal", seed),
    name,
    time,
    mealType,
    label,
    macros: {
      kcal,
      protein_g: protein,
      fat_g: fat,
      carbs_g: carbs,
    },
    source: "manual" as const,
    macroSource: "manual" as const,
    amount_g: null,
    foodId: null,
  });

  const log = {
    [today]: {
      meals: [
        meal(
          1,
          "08:20",
          "Сніданок",
          "Омлет + тост",
          420,
          22,
          18,
          38,
          "breakfast",
        ),
        meal(
          2,
          "13:15",
          "Обід",
          "Курка з рисом і салатом",
          640,
          42,
          16,
          72,
          "lunch",
        ),
        meal(
          3,
          "16:30",
          "Перекус",
          "Протеїновий батончик",
          190,
          15,
          6,
          18,
          "snack",
        ),
      ],
    },
    [yesterday]: {
      meals: [
        meal(
          4,
          "09:00",
          "Сніданок",
          "Вівсянка з ягодами",
          360,
          12,
          8,
          56,
          "breakfast",
        ),
        meal(
          5,
          "14:00",
          "Обід",
          "Лосось, кіноа, брокколі",
          580,
          38,
          22,
          48,
          "lunch",
        ),
        meal(
          6,
          "19:30",
          "Вечеря",
          "Індичка + овочі",
          490,
          44,
          14,
          28,
          "dinner",
        ),
      ],
    },
  };
  writeJSON(NUTRITION_LOG_KEY, log);

  // Prefs: daily targets so the dashboard progress bars render with
  // a known goal rather than empty rings.
  writeJSON(NUTRITION_PREFS_KEY, {
    goal: "maintain",
    servings: 2,
    timeMinutes: 30,
    exclude: "",
    dailyTargetKcal: 2200,
    dailyTargetProtein_g: 140,
    dailyTargetFat_g: 70,
    dailyTargetCarbs_g: 240,
    mealTemplates: [],
    reminderEnabled: false,
    reminderHour: 9,
    waterGoalMl: 2500,
  });

  // A half-full water log for today — tracker bar shows real progress.
  writeJSON("nutrition_water_v1", {
    [today]: { ml: 1400 },
    [yesterday]: { ml: 2200 },
  });
}

// ──────────────────────────────────────────────────────────────────
// public API
// ──────────────────────────────────────────────────────────────────

const SEEDED_KEYS = [
  DEMO_FLAG_KEY,
  FINYK_MANUAL_EXPENSES_KEY,
  FINYK_CUSTOM_CATS_KEY,
  FINYK_MONTHLY_PLAN_KEY,
  FINYK_MANUAL_ONLY_KEY,
  FIZRUK_WORKOUTS_KEY,
  FIZRUK_MEASUREMENTS_KEY,
  ROUTINE_STATE_KEY,
  NUTRITION_LOG_KEY,
  NUTRITION_PREFS_KEY,
  "nutrition_water_v1",
  ONBOARDING_DONE_KEY,
  FIRST_REAL_ENTRY_KEY,
  DEMO_CLEANUP_DONE_KEY,
];

/** Write the full demo payload. Safe to call multiple times. */
export function seedDemoData(): void {
  // Skip the one-time cleanup that would otherwise nuke demo-flagged
  // rows on the next boot.
  writeRaw(DEMO_CLEANUP_DONE_KEY, "1");
  // Skip the welcome / onboarding splash.
  writeRaw(ONBOARDING_DONE_KEY, "1");
  // Tell the «first real entry» analytics gate that we've already fired.
  writeRaw(FIRST_REAL_ENTRY_KEY, "1");

  seedFinyk();
  seedFizruk();
  seedRoutine();
  seedNutrition();

  writeRaw(DEMO_FLAG_KEY, "1");
}

/** Wipe everything the seeder writes. */
export function resetDemoData(): void {
  for (const k of SEEDED_KEYS) removeKey(k);
}

/**
 * Called from `main.jsx` on every cold start. If the current URL has
 * `?demo=1` (alias: `?demo=seed`), seed the store and reload onto `/`.
 * `?demo=reset` clears the seeded payload and reloads. All other URLs
 * return immediately.
 */
export function runDemoSeedFromUrl(): void {
  if (typeof window === "undefined") return;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  const mode = params.get("demo");
  if (!mode) return;

  if (mode === "reset") {
    resetDemoData();
  } else if (mode === "1" || mode === "seed") {
    seedDemoData();
  } else {
    return;
  }

  // Strip the query param and reload so the rest of the boot sequence
  // (storageManager migrations, AuthProvider, etc.) sees a "clean" URL
  // against already-populated storage.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    url.pathname = "/";
    window.location.replace(url.toString());
  } catch {
    window.location.replace("/");
  }
}
