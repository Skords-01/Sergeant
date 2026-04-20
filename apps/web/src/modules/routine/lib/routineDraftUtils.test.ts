import { describe, it, expect } from "vitest";
import {
  normalizeReminderTimes,
  habitDraftToPatch,
} from "./routineDraftUtils.js";

describe("routine/routineDraftUtils", () => {
  it("normalizeReminderTimes uses reminderTimes if valid", () => {
    expect(normalizeReminderTimes({ reminderTimes: ["08:00", "xx"] })).toEqual([
      "08:00",
    ]);
  });

  it("normalizeReminderTimes falls back to legacy timeOfDay", () => {
    expect(normalizeReminderTimes({ timeOfDay: "13:00" })).toEqual(["13:00"]);
    expect(normalizeReminderTimes({ timeOfDay: "nope" })).toEqual([]);
  });

  it("habitDraftToPatch normalizes times and endDate", () => {
    const p = habitDraftToPatch({
      name: "  Test  ",
      emoji: "",
      tagIds: ["t1"],
      categoryId: "",
      recurrence: "daily",
      startDate: "2026-01-01",
      endDate: " ",
      timeOfDay: "20:00",
      reminderTimes: [" 08:00 ", "bad", "13:00:00"],
      weekdays: [1, 2, 3],
    });
    expect(p.name).toBe("Test");
    expect(p.emoji).toBe("✓");
    expect(p.categoryId).toBe(null);
    expect(p.endDate).toBe(null);
    expect(p.reminderTimes).toEqual(["08:00", "13:00"]);
    expect(p.timeOfDay).toBe("08:00");
    expect(p.weekdays).toEqual([1, 2, 3]);
  });
});
