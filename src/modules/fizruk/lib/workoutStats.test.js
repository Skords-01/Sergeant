import { describe, expect, it } from "vitest";
import {
  completedWorkoutsCount,
  formatCompactKg,
  personalRecordsExerciseCount,
  totalCompletedVolumeKg,
  workoutDurationSec,
  workoutTonnageKg,
  weeklyVolumeSeriesNow,
} from "./workoutStats.js";

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
