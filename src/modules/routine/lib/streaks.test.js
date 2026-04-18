import { describe, it, expect } from "vitest";
import {
  streakForHabit,
  maxStreakAllTime,
  completionRateForRange,
} from "./streaks.js";

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

  it("maxStreakAllTime keeps historical completions after schedule narrowing", () => {
    // Звичка зараз weekly (пн/ср/пт), але раніше була daily і користувач
    // виконував її щодня. Історичний best streak не має зникати.
    const h = {
      id: "h",
      archived: false,
      recurrence: "weekly",
      startDate: "2026-01-01",
      endDate: null,
      weekdays: [0, 2, 4], // пн, ср, пт (ISO 0-based)
    };
    const completions = [
      "2026-01-05", // пн
      "2026-01-06", // вт (не заплановано зараз)
      "2026-01-07", // ср
      "2026-01-08", // чт (не заплановано)
      "2026-01-09", // пт
    ];
    expect(maxStreakAllTime(h, completions)).toBe(5);
  });

  it("streakForHabit terminates for monthly habits with long history", () => {
    // Раніше магічний ліміт 500 ітерацій обривав multi-year monthly-стрік.
    const h = {
      id: "h",
      archived: false,
      recurrence: "monthly",
      startDate: "2023-01-15",
      endDate: null,
    };
    const completions = [];
    for (let y = 2023; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === 2026 && m > 1) break;
        completions.push(`${y}-${String(m).padStart(2, "0")}-15`);
      }
    }
    // Сьогодні — 15 січ 2026; 37 послідовних місячних виконань підряд.
    expect(streakForHabit(h, completions, "2026-01-15")).toBe(37);
  });

  it("completionRateForRange returns scheduled/completed/rate", () => {
    const h1 = dailyHabit("h1");
    const h2 = dailyHabit("h2");
    const completions = {
      h1: ["2026-01-02"],
      h2: ["2026-01-01", "2026-01-02"],
    };
    const r = completionRateForRange(
      [h1, h2],
      completions,
      "2026-01-01",
      "2026-01-02",
    );
    expect(r.scheduled).toBe(4);
    expect(r.completed).toBe(3);
    expect(r.rate).toBeCloseTo(0.75);
  });
});
