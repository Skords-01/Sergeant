/**
 * Built-in training programs for Fizruk.
 * Each program defines a weekly schedule with session keys and exercise IDs.
 * All exercise IDs correspond to entries in exercises.gymup.json.
 * progressionKg: how many kg to add per session for compound lifts.
 */

export const BUILTIN_PROGRAMS = [
  {
    id: "ppl",
    name: "Push Pull Legs",
    description:
      "Класична 6-денна програма. Push (груди/плечі/трицепс), Pull (спина/біцепс), Legs (ноги/сідниці). Відмінно для середнього рівня.",
    days: 6,
    schedule: [
      { day: 1, sessionKey: "push", name: "Push — Груди, плечі, трицепс" },
      { day: 2, sessionKey: "pull", name: "Pull — Спина, біцепс" },
      { day: 3, sessionKey: "legs", name: "Legs — Ноги, сідниці" },
      { day: 4, sessionKey: "push", name: "Push — Груди, плечі, трицепс" },
      { day: 5, sessionKey: "pull", name: "Pull — Спина, біцепс" },
      { day: 6, sessionKey: "legs", name: "Legs — Ноги, сідниці" },
    ],
    sessions: {
      push: {
        name: "Push Day",
        exerciseIds: [
          "bench_press_barbell",
          "overhead_press_barbell",
          "incline_bench_press",
          "lateral_raise",
          "tricep_pushdown",
          "overhead_tricep_extension",
        ],
        progressionKg: 2.5,
        defaultRestSec: 90,
      },
      pull: {
        name: "Pull Day",
        exerciseIds: [
          "deadlift",
          "pullup",
          "barbell_row",
          "cable_face_pull",
          "bicep_curl_barbell",
          "hammer_curl",
        ],
        progressionKg: 2.5,
        defaultRestSec: 90,
      },
      legs: {
        name: "Leg Day",
        exerciseIds: [
          "squat_barbell",
          "romanian_deadlift",
          "leg_press",
          "leg_curl",
          "leg_extension",
          "calf_raise_standing",
        ],
        progressionKg: 5,
        defaultRestSec: 120,
      },
    },
  },
  {
    id: "upper_lower",
    name: "Upper / Lower",
    description:
      "4-денна програма: два тренування на верх тіла та два на низ. Оптимальна частота для кожної групи. Підходить для початківців та середнього рівня.",
    days: 4,
    schedule: [
      { day: 1, sessionKey: "upper_a", name: "Upper A — Верх тіла (сила)" },
      { day: 2, sessionKey: "lower_a", name: "Lower A — Низ тіла (сила)" },
      { day: 4, sessionKey: "upper_b", name: "Upper B — Верх тіла (об'єм)" },
      { day: 5, sessionKey: "lower_b", name: "Lower B — Низ тіла (об'єм)" },
    ],
    sessions: {
      upper_a: {
        name: "Upper A (сила)",
        exerciseIds: [
          "bench_press_barbell",
          "barbell_row",
          "overhead_press_barbell",
          "pullup",
          "bicep_curl_barbell",
          "tricep_pushdown",
        ],
        progressionKg: 2.5,
        defaultRestSec: 90,
      },
      lower_a: {
        name: "Lower A (сила)",
        exerciseIds: [
          "squat_barbell",
          "romanian_deadlift",
          "leg_press",
          "leg_curl",
          "calf_raise_standing",
        ],
        progressionKg: 5,
        defaultRestSec: 120,
      },
      upper_b: {
        name: "Upper B (об'єм)",
        exerciseIds: [
          "incline_bench_press",
          "cable_seated_row",
          "lateral_raise",
          "cable_face_pull",
          "bicep_curl_dumbbell",
          "overhead_tricep_extension",
        ],
        progressionKg: 2.5,
        defaultRestSec: 75,
      },
      lower_b: {
        name: "Lower B (об'єм)",
        exerciseIds: [
          "deadlift",
          "leg_press",
          "leg_extension",
          "leg_curl",
          "calf_raise_standing",
        ],
        progressionKg: 5,
        defaultRestSec: 90,
      },
    },
  },
  {
    id: "full_body",
    name: "Full Body 3×тиждень",
    description:
      "Три повних тренування тіла на тиждень (Пн/Ср/Пт). Ідеально для початківців та тих, хто має обмежений час. Максимальна частота стимуляції м'язів.",
    days: 3,
    schedule: [
      { day: 1, sessionKey: "full_a", name: "Full Body A" },
      { day: 3, sessionKey: "full_b", name: "Full Body B" },
      { day: 5, sessionKey: "full_a", name: "Full Body A" },
    ],
    sessions: {
      full_a: {
        name: "Full Body A",
        exerciseIds: [
          "squat_barbell",
          "bench_press_barbell",
          "barbell_row",
          "overhead_press_barbell",
          "deadlift",
        ],
        progressionKg: 2.5,
        defaultRestSec: 90,
      },
      full_b: {
        name: "Full Body B",
        exerciseIds: [
          "deadlift",
          "incline_bench_press",
          "pullup",
          "lateral_raise",
          "squat_barbell",
        ],
        progressionKg: 2.5,
        defaultRestSec: 90,
      },
    },
  },
  {
    id: "starting_strength",
    name: "Лінійна прогресія",
    description:
      "3-денна програма на основі базових багатосуглобових рухів. Щотренування +2.5 кг на штанзі. Найкраще для новачків — швидкий набір сили.",
    days: 3,
    schedule: [
      { day: 1, sessionKey: "ss_a", name: "Workout A" },
      { day: 3, sessionKey: "ss_b", name: "Workout B" },
      { day: 5, sessionKey: "ss_a", name: "Workout A" },
    ],
    sessions: {
      ss_a: {
        name: "Workout A",
        exerciseIds: ["squat_barbell", "bench_press_barbell", "deadlift"],
        progressionKg: 2.5,
        defaultRestSec: 180,
      },
      ss_b: {
        name: "Workout B",
        exerciseIds: ["squat_barbell", "overhead_press_barbell", "deadlift"],
        progressionKg: 2.5,
        defaultRestSec: 180,
      },
    },
  },
];

/** Get the session for a given program and day index (0=Mon…6=Sun). */
export function getProgramSessionForDay(program, dayIndex) {
  if (!program) return null;
  return program.schedule.find((s) => s.day - 1 === dayIndex) || null;
}

/** Get today's session (based on current weekday). */
export function getTodaySession(program) {
  if (!program) return null;
  const dayIndex = (new Date().getDay() + 6) % 7;
  return getProgramSessionForDay(program, dayIndex);
}

export function getDefaultRestSec(primaryGroup) {
  if (!primaryGroup) return 90;
  const compound = ["chest", "back", "legs", "glutes", "full_body"];
  const isolation = ["shoulders", "arms", "core"];
  if (compound.includes(primaryGroup)) return 90;
  if (isolation.includes(primaryGroup)) return 60;
  return 30;
}
