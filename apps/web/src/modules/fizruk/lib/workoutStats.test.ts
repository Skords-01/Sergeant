import { describe, expect, it } from "vitest";
import {
  completedWorkoutsCount,
  formatCompactKg,
  getExercisePR,
  personalRecordsExerciseCount,
  suggestNextSet,
  totalCompletedVolumeKg,
  workoutDurationSec,
  workoutTonnageKg,
  weeklyVolumeSeriesNow,
} from "./workoutStats";

describe("workoutTonnageKg", () => {
  it("sums strength sets", () => {
    const w = {
      items: [
        {
          type: "strength",
          sets: [
            { weightKg: 50, reps: 10 },
            { weightKg: 50, reps: 8 },
          ],
        },
      ],
    };
    expect(workoutTonnageKg(w)).toBe(50 * 10 + 50 * 8);
  });

  it("returns 0 for empty", () => {
    expect(workoutTonnageKg({ items: [] })).toBe(0);
  });
});

describe("workoutDurationSec", () => {
  it("returns 0 without startedAt", () => {
    expect(workoutDurationSec({})).toBe(0);
  });
});

describe("personalRecordsExerciseCount", () => {
  it("counts distinct exercises with strength sets", () => {
    const workouts = [
      {
        items: [
          {
            exerciseId: "a",
            type: "strength",
            sets: [{ weightKg: 50, reps: 10 }],
          },
          {
            exerciseId: "b",
            type: "strength",
            sets: [{ weightKg: 50, reps: 5 }],
          },
        ],
      },
    ];
    expect(personalRecordsExerciseCount(workouts)).toBe(2);
  });
});

describe("weeklyVolumeSeriesNow", () => {
  it("returns 7 volume slots", () => {
    const { volumeKg } = weeklyVolumeSeriesNow([]);
    expect(volumeKg).toHaveLength(7);
  });
});

describe("formatCompactKg", () => {
  it("formats thousands", () => {
    expect(formatCompactKg(1500)).toMatch(/k/);
  });
});

describe("completedWorkoutsCount", () => {
  it("counts ended workouts", () => {
    expect(completedWorkoutsCount([{ endedAt: "x" }, {}])).toBe(1);
  });
});

describe("totalCompletedVolumeKg", () => {
  it("sums tonnage of completed", () => {
    const w = {
      endedAt: "2020-01-01",
      items: [{ type: "strength", sets: [{ weightKg: 10, reps: 5 }] }],
    };
    expect(totalCompletedVolumeKg([w])).toBe(50);
  });
});

describe("getExercisePR", () => {
  const workouts = [
    {
      startedAt: "2026-01-10T10:00:00Z",
      items: [
        {
          exerciseId: "bench",
          type: "strength",
          sets: [
            { weightKg: 60, reps: 8 },
            { weightKg: 65, reps: 5 },
          ],
        },
      ],
    },
    {
      startedAt: "2026-01-17T10:00:00Z",
      items: [
        {
          exerciseId: "bench",
          type: "strength",
          sets: [{ weightKg: 70, reps: 4 }],
        },
      ],
    },
  ];

  it("returns the best 1RM set and its date", () => {
    const pr = getExercisePR(workouts, "bench");
    expect(pr.best1rm).toBeGreaterThan(0);
    expect(pr.bestSet).toBeDefined();
    expect(pr.date).toBe("2026-01-17T10:00:00Z");
  });

  it("returns zero best1rm for missing exercise", () => {
    const pr = getExercisePR(workouts, "squat");
    expect(pr.best1rm).toBe(0);
    expect(pr.bestSet).toBeNull();
    expect(pr.date).toBeNull();
  });

  it("returns null for empty workouts", () => {
    const pr = getExercisePR([], "bench");
    expect(pr.best1rm).toBe(0);
  });
});

describe("suggestNextSet", () => {
  it("returns null for empty or zero input", () => {
    expect(suggestNextSet(null)).toBeNull();
    expect(suggestNextSet({ weightKg: 0, reps: 8 })).toBeNull();
    expect(suggestNextSet({ weightKg: 60, reps: 0 })).toBeNull();
  });

  it("reps ≤ 5: adds 2.5 kg, no alt", () => {
    const s = suggestNextSet({ weightKg: 100, reps: 5 });
    expect(s.weightKg).toBe(102.5);
    expect(s.reps).toBe(5);
    expect(s.altWeightKg).toBeUndefined();
  });

  it("reps 6-10: adds 2.5 kg primary + same-weight +1 rep alt", () => {
    const s = suggestNextSet({ weightKg: 80, reps: 8 });
    expect(s.weightKg).toBe(82.5);
    expect(s.reps).toBe(8);
    expect(s.altWeightKg).toBe(80);
    expect(s.altReps).toBe(9);
  });

  it("reps > 10: adds 5% rounded to 2.5 kg, no alt", () => {
    const s = suggestNextSet({ weightKg: 40, reps: 12 });
    expect(s.weightKg).toBe(42.5);
    expect(s.altWeightKg).toBeUndefined();
  });

  it("result weightKg is always a multiple of 2.5", () => {
    [3, 8, 15].forEach((reps) => {
      const s = suggestNextSet({ weightKg: 67.5, reps });
      expect(s.weightKg % 2.5).toBeCloseTo(0);
    });
  });
});
