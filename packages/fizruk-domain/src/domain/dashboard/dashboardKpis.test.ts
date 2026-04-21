import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEIGHT_WINDOW_DAYS,
  computeDashboardKpis,
  computeStreakDays,
  computeWeeklyTotals,
  computeWeightChangeKg,
} from "./dashboardKpis.js";

const FROZEN_NOW = new Date("2026-04-22T12:00:00Z"); // Wednesday

function strengthWorkout(
  endedAt: string,
  sets: Array<[number, number]>,
  startedAt?: string,
) {
  return {
    startedAt: startedAt ?? endedAt,
    endedAt,
    items: [
      {
        exerciseId: "bench",
        type: "strength",
        sets: sets.map(([weightKg, reps]) => ({ weightKg, reps })),
      },
    ],
  };
}

describe("computeStreakDays", () => {
  it("returns 0 for empty / null inputs", () => {
    expect(computeStreakDays(null, FROZEN_NOW)).toBe(0);
    expect(computeStreakDays(undefined, FROZEN_NOW)).toBe(0);
    expect(computeStreakDays([], FROZEN_NOW)).toBe(0);
  });

  it("ignores workouts that lack a completion timestamp", () => {
    const workouts = [
      { startedAt: "2026-04-22T10:00:00Z", endedAt: null, items: [] },
    ];
    expect(computeStreakDays(workouts, FROZEN_NOW)).toBe(0);
  });

  it("counts consecutive local days ending today", () => {
    const workouts = [
      strengthWorkout("2026-04-22T10:00:00Z", [[60, 5]]),
      strengthWorkout("2026-04-21T11:00:00Z", [[60, 5]]),
      strengthWorkout("2026-04-20T12:00:00Z", [[60, 5]]),
    ];
    expect(computeStreakDays(workouts, FROZEN_NOW)).toBe(3);
  });

  it("grants a 1-day grace when today is empty but yesterday is not", () => {
    const workouts = [
      strengthWorkout("2026-04-21T11:00:00Z", [[60, 5]]),
      strengthWorkout("2026-04-20T12:00:00Z", [[60, 5]]),
    ];
    expect(computeStreakDays(workouts, FROZEN_NOW)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday has any workouts", () => {
    const workouts = [strengthWorkout("2026-04-19T11:00:00Z", [[60, 5]])];
    expect(computeStreakDays(workouts, FROZEN_NOW)).toBe(0);
  });

  it("breaks the streak on the first missing day", () => {
    const workouts = [
      strengthWorkout("2026-04-22T10:00:00Z", [[60, 5]]),
      // gap on 2026-04-21
      strengthWorkout("2026-04-20T12:00:00Z", [[60, 5]]),
    ];
    expect(computeStreakDays(workouts, FROZEN_NOW)).toBe(1);
  });
});

describe("computeWeeklyTotals", () => {
  it("returns zero totals for empty input", () => {
    expect(computeWeeklyTotals([], FROZEN_NOW)).toEqual({
      count: 0,
      volumeKg: 0,
    });
  });

  it("sums workouts falling within the current Mon-first week", () => {
    const workouts = [
      // Monday of the current week (2026-04-20)
      strengthWorkout("2026-04-20T10:00:00Z", [
        [100, 5],
        [100, 5],
      ]),
      // Wednesday (today)
      strengthWorkout("2026-04-22T10:00:00Z", [[60, 10]]),
      // Sunday of previous week — excluded
      strengthWorkout("2026-04-19T10:00:00Z", [[200, 5]]),
    ];
    expect(computeWeeklyTotals(workouts, FROZEN_NOW)).toEqual({
      count: 2,
      volumeKg: 100 * 5 + 100 * 5 + 60 * 10,
    });
  });

  it("skips non-strength items and invalid sets", () => {
    const workouts = [
      {
        startedAt: "2026-04-21T10:00:00Z",
        endedAt: "2026-04-21T11:00:00Z",
        items: [
          {
            exerciseId: "run",
            type: "distance",
            sets: [{ weightKg: 999, reps: 999 }],
          },
          {
            exerciseId: "bench",
            type: "strength",
            sets: [
              { weightKg: 0, reps: 5 },
              { weightKg: 50, reps: 0 },
              { weightKg: 50, reps: 5 },
            ],
          },
        ],
      },
    ];
    expect(computeWeeklyTotals(workouts, FROZEN_NOW)).toEqual({
      count: 1,
      volumeKg: 250,
    });
  });
});

describe("computeWeightChangeKg", () => {
  it("returns null for empty input or single sample", () => {
    expect(computeWeightChangeKg(null)).toBeNull();
    expect(computeWeightChangeKg([], { now: FROZEN_NOW })).toBeNull();
    expect(
      computeWeightChangeKg([{ at: "2026-04-20T00:00:00Z", weightKg: 80 }], {
        now: FROZEN_NOW,
      }),
    ).toBeNull();
  });

  it("returns the signed delta between oldest and newest in-window samples", () => {
    const delta = computeWeightChangeKg(
      [
        { at: "2026-04-01T00:00:00Z", weightKg: 82 },
        { at: "2026-04-10T00:00:00Z", weightKg: 81.5 },
        { at: "2026-04-20T00:00:00Z", weightKg: 80.3 },
      ],
      { now: FROZEN_NOW, windowDays: 30 },
    );
    expect(delta).toBe(-1.7);
  });

  it("excludes samples outside the window", () => {
    const delta = computeWeightChangeKg(
      [
        { at: "2024-01-01T00:00:00Z", weightKg: 90 }, // far past
        { at: "2026-04-15T00:00:00Z", weightKg: 81 },
        { at: "2026-04-22T00:00:00Z", weightKg: 82 },
      ],
      { now: FROZEN_NOW, windowDays: 30 },
    );
    // Only the two in-window samples contribute.
    expect(delta).toBe(1);
  });

  it("ignores non-numeric weight values", () => {
    const delta = computeWeightChangeKg(
      [
        { at: "2026-04-10T00:00:00Z", weightKg: "80.5" },
        { at: "2026-04-20T00:00:00Z", weightKg: 82 },
        { at: "2026-04-21T00:00:00Z", weightKg: null },
      ],
      { now: FROZEN_NOW, windowDays: 30 },
    );
    expect(delta).toBe(1.5);
  });
});

describe("computeDashboardKpis", () => {
  it("returns zero-state for empty inputs", () => {
    const kpis = computeDashboardKpis(null, { now: FROZEN_NOW });
    expect(kpis).toEqual({
      streakDays: 0,
      weeklyWorkoutsCount: 0,
      weeklyVolumeKg: 0,
      totalCompletedCount: 0,
      avgDurationSec: 0,
      latestWorkoutIso: null,
      weightChangeKg: null,
      weightWindowDays: DEFAULT_WEIGHT_WINDOW_DAYS,
    });
  });

  it("surfaces the latest workout and averages duration", () => {
    const workouts = [
      {
        startedAt: "2026-04-20T10:00:00Z",
        endedAt: "2026-04-20T11:00:00Z", // 3600s
        items: [],
      },
      {
        startedAt: "2026-04-22T12:00:00Z",
        endedAt: "2026-04-22T12:30:00Z", // 1800s
        items: [],
      },
    ];
    const kpis = computeDashboardKpis(workouts, { now: FROZEN_NOW });
    expect(kpis.latestWorkoutIso).toBe("2026-04-22T12:30:00Z");
    expect(kpis.totalCompletedCount).toBe(2);
    expect(kpis.avgDurationSec).toBe(2700);
  });

  it("rolls up weekly volume into an integer kg figure", () => {
    const workouts = [strengthWorkout("2026-04-22T10:00:00Z", [[62.5, 8]])];
    const kpis = computeDashboardKpis(workouts, { now: FROZEN_NOW });
    expect(kpis.weeklyVolumeKg).toBe(500);
  });

  it("passes weightChangeKg + window through", () => {
    const kpis = computeDashboardKpis([], {
      now: FROZEN_NOW,
      measurements: [
        { at: "2026-04-10T00:00:00Z", weightKg: 80 },
        { at: "2026-04-20T00:00:00Z", weightKg: 81 },
      ],
      weightWindowDays: 14,
    });
    expect(kpis.weightChangeKg).toBe(1);
    expect(kpis.weightWindowDays).toBe(14);
  });
});
