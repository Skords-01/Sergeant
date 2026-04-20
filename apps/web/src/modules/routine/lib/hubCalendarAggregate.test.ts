import { describe, expect, it } from "vitest";
import {
  buildHubCalendarEvents,
  habitScheduledOnDate,
} from "./hubCalendarAggregate.js";

function base(over = {}) {
  return {
    archived: false,
    recurrence: "daily",
    startDate: "2025-01-01",
    endDate: null,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    ...over,
  };
}

describe("habitScheduledOnDate", () => {
  it("повертає false до startDate", () => {
    expect(habitScheduledOnDate(base(), "2024-12-31")).toBe(false);
  });

  it("daily — true в межах періоду", () => {
    expect(habitScheduledOnDate(base(), "2025-06-15")).toBe(true);
  });

  it("once — лише день startDate", () => {
    const h = base({ recurrence: "once", startDate: "2025-03-10" });
    expect(habitScheduledOnDate(h, "2025-03-10")).toBe(true);
    expect(habitScheduledOnDate(h, "2025-03-11")).toBe(false);
  });

  it("weekdays — сб/нд виключені (2025-03-01 субота)", () => {
    const h = base({ recurrence: "weekdays" });
    expect(habitScheduledOnDate(h, "2025-03-01")).toBe(false);
    expect(habitScheduledOnDate(h, "2025-03-03")).toBe(true);
  });

  it("monthly — той самий числовий день місяця", () => {
    const h = base({ recurrence: "monthly", startDate: "2024-01-31" });
    expect(habitScheduledOnDate(h, "2025-01-31")).toBe(true);
    expect(habitScheduledOnDate(h, "2025-02-28")).toBe(true);
  });
});

describe("buildHubCalendarEvents", () => {
  it("додає подію звички на кожен день діапазону", () => {
    const state = {
      prefs: { showFinykSubscriptionsInCalendar: false },
      tags: [],
      categories: [],
      habits: [
        {
          id: "h1",
          name: "Вода",
          emoji: "💧",
          archived: false,
          recurrence: "daily",
          startDate: "2025-06-01",
          endDate: null,
          tagIds: [],
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          timeOfDay: "",
        },
      ],
      completions: { h1: ["2025-06-10"] },
      habitOrder: ["h1"],
      completionNotes: {},
    };
    const events = buildHubCalendarEvents(
      state,
      { startKey: "2025-06-10", endKey: "2025-06-11" },
      { showFizruk: false, showFinykSubs: false },
    );
    const habitEv = events.filter((e) => e.habitId === "h1");
    expect(habitEv.length).toBe(2);
    expect(habitEv.find((e) => e.date === "2025-06-10")?.completed).toBe(true);
    expect(habitEv.find((e) => e.date === "2025-06-11")?.completed).toBe(false);
  });
});
