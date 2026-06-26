// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { safeWriteLS } from "@shared/lib/storage/storage";
import {
  MEASUREMENTS_STORAGE_KEY,
  WORKOUTS_STORAGE_KEY,
} from "@sergeant/fizruk-domain";
import {
  readDemoWorkoutsFromLs,
  readDemoMeasurementsFromLs,
} from "./demoLsRead";
import { seedFizruk } from "../../../core/onboarding/seedDemoData/seedFizruk";

beforeEach(() => {
  localStorage.clear();
});

describe("demoLsRead", () => {
  it("reads the seeded workouts blob (seeder { schemaVersion, workouts } shape)", () => {
    safeWriteLS(WORKOUTS_STORAGE_KEY, {
      schemaVersion: 1,
      workouts: [
        {
          id: "demo_wo_1",
          startedAt: "2026-06-20T18:30:00.000Z",
          endedAt: "2026-06-20T19:25:00.000Z",
          items: [],
          groups: [],
          warmup: null,
          cooldown: null,
          note: "",
        },
      ],
    });
    const out = readDemoWorkoutsFromLs();
    expect(out?.map((w) => w.id)).toEqual(["demo_wo_1"]);
  });

  it("returns null when the workouts key is absent", () => {
    expect(readDemoWorkoutsFromLs()).toBeNull();
  });

  it("reads the seeded measurements array", () => {
    safeWriteLS(MEASUREMENTS_STORAGE_KEY, [
      { id: "demo_m_1", at: "2026-06-24T08:00:00.000Z", weight: 78.4 },
    ]);
    const out = readDemoMeasurementsFromLs();
    expect(out?.map((m) => m.id)).toEqual(["demo_m_1"]);
  });

  it("returns null when the measurements key is absent", () => {
    expect(readDemoMeasurementsFromLs()).toBeNull();
  });

  // Integration: the readers must parse exactly what the real demo seeder
  // writes — the whole point of the demo fallback. Guards against the
  // seeder and reader drifting on key name or payload shape.
  it("parses the real seedFizruk() output", () => {
    seedFizruk();
    const workouts = readDemoWorkoutsFromLs();
    expect(workouts).not.toBeNull();
    expect(workouts!.length).toBeGreaterThan(0);
    expect(workouts!.every((w) => typeof w.id === "string" && w.id)).toBe(true);

    const measurements = readDemoMeasurementsFromLs();
    expect(measurements).not.toBeNull();
    expect(measurements!.length).toBeGreaterThan(0);
  });
});
