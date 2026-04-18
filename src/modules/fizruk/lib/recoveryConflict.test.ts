import { describe, expect, it } from "vitest";
import {
  recoveryConflictsForExercise,
  recoveryConflictsForWorkoutItem,
} from "./recoveryConflict";

describe("recoveryConflictsForExercise", () => {
  it("returns no warning when muscles empty", () => {
    const ex = { muscles: { primary: [], secondary: [] } };
    const cf = recoveryConflictsForExercise(ex, {});
    expect(cf.hasWarning).toBe(false);
  });

  it("flags red when primary muscle is red", () => {
    const ex = { muscles: { primary: ["chest"], secondary: [] } };
    const by = { chest: { label: "Груди", status: "red" } };
    const cf = recoveryConflictsForExercise(ex, by);
    expect(cf.hasWarning).toBe(true);
    expect(cf.red.length).toBe(1);
  });

  it("flags yellow for secondary", () => {
    const ex = { muscles: { primary: [], secondary: ["back"] } };
    const by = { back: { label: "Спина", status: "yellow" } };
    const cf = recoveryConflictsForExercise(ex, by);
    expect(cf.yellow.length).toBe(1);
  });
});

describe("recoveryConflictsForWorkoutItem", () => {
  it("maps item muscles to exercise shape", () => {
    const it = { musclesPrimary: ["legs"], musclesSecondary: [] };
    const by = { legs: { label: "Ноги", status: "red" } };
    const cf = recoveryConflictsForWorkoutItem(it, by);
    expect(cf.hasWarning).toBe(true);
  });
});
