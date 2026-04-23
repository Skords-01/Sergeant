// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { DashboardKpis } from "@sergeant/fizruk-domain/domain";

import { KpiRow } from "./KpiRow";

afterEach(() => {
  cleanup();
});

function makeKpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    streakDays: 0,
    weeklyWorkoutsCount: 0,
    weeklyVolumeKg: 0,
    totalCompletedCount: 0,
    avgDurationSec: 0,
    latestWorkoutIso: null,
    weightChangeKg: null,
    weightWindowDays: 30,
    ...overrides,
  };
}

describe("KpiRow", () => {
  it("renders zero-state placeholders when the user has no data yet", () => {
    render(<KpiRow kpis={makeKpis()} />);
    expect(screen.getByText("0 днів")).toBeDefined();
    expect(screen.getByText("0 кг")).toBeDefined();
    expect(screen.getByText("Додай заміри")).toBeDefined();
    expect(screen.getByText("Почни сьогодні або вчора")).toBeDefined();
  });

  it("pluralises the streak, weekly volume, and workouts count", () => {
    render(
      <KpiRow
        kpis={makeKpis({
          streakDays: 3,
          weeklyWorkoutsCount: 4,
          weeklyVolumeKg: 10000,
        })}
      />,
    );
    expect(screen.getByText("3 дні")).toBeDefined();
    expect(screen.getByText("4 тренування")).toBeDefined();
    // 10000 kg → 10 т (rounded as whole tonnes once >= 10)
    expect(screen.getByText("10 т")).toBeDefined();
  });

  it("keeps sub-tonne volume formatted in kg", () => {
    render(
      <KpiRow
        kpis={makeKpis({
          streakDays: 1,
          weeklyWorkoutsCount: 1,
          weeklyVolumeKg: 420,
        })}
      />,
    );
    expect(screen.getByText("1 день")).toBeDefined();
    expect(screen.getByText("1 тренування")).toBeDefined();
    expect(screen.getByText("420 кг")).toBeDefined();
  });

  it("formats a negative weight delta as positive tone", () => {
    render(<KpiRow kpis={makeKpis({ weightChangeKg: -1.4 })} />);
    // −1.4 → displays rounded to 1 decimal, with minus sign
    const node = screen.getByText("−1.4 кг");
    expect(node.className).toContain("text-success");
  });

  it("formats a positive weight delta as negative tone", () => {
    render(<KpiRow kpis={makeKpis({ weightChangeKg: 2 })} />);
    const node = screen.getByText("+2 кг");
    expect(node.className).toContain("text-danger");
  });

  it("shows the dash placeholder when no weight samples are available", () => {
    render(<KpiRow kpis={makeKpis({ weightChangeKg: null })} />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("uses the correct Ukrainian 11/12/14 plural forms", () => {
    const { rerender } = render(<KpiRow kpis={makeKpis({ streakDays: 11 })} />);
    expect(screen.getByText("11 днів")).toBeDefined();
    rerender(<KpiRow kpis={makeKpis({ streakDays: 21 })} />);
    expect(screen.getByText("21 день")).toBeDefined();
    rerender(<KpiRow kpis={makeKpis({ streakDays: 22 })} />);
    expect(screen.getByText("22 дні")).toBeDefined();
  });
});
