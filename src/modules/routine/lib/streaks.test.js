import { describe, it, expect } from "vitest";
import { streakForHabit, maxStreakAllTime, completionRateForRange } from "./streaks.js";

function dailyHabit(id = "h1") {
  return {
    id,
    archived: false,
    recurrence: "daily",
    startDate: "2026-01-01",
    endDate: null,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };
}

describe("routine/streaks", () => {
  it("streakForHabit counts consecutive scheduled completions backwards", () => {
    const h = dailyHabit("h");
    const todayKey = "2026-01-10";
    const completions = ["2026-01-10", "2026-01-09", "2026-01-08"];
    expect(streakForHabit(h, completions, todayKey)).toBe(3);
    expect(streakForHabit(h, ["2026-01-10", "2026-01-08"], todayKey)).toBe(1);
  });

  it("maxStreakAllTime finds best streak", () => {
    const h = dailyHabit("h");
    const completions = [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-05",
      "2026-01-06",
    ];
    expect(maxStreakAllTime(h, completions)).toBe(3);
  });

  it("completionRateForRange returns scheduled/completed/rate", () => {
    const h1 = dailyHabit("h1");
    const h2 = dailyHabit("h2");
    const completions = { h1: ["2026-01-02"], h2: ["2026-01-01", "2026-01-02"] };
    const r = completionRateForRange([h1, h2], completions, "2026-01-01", "2026-01-02");
    expect(r.scheduled).toBe(4);
    expect(r.completed).toBe(3);
    expect(r.rate).toBeCloseTo(0.75);
  });
});

