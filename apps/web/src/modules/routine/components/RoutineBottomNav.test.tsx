/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoutineBottomNav } from "./RoutineBottomNav";

describe("RoutineBottomNav", () => {
  it("renders tablist and switches tab", () => {
    const onSelectTab = vi.fn();
    render(<RoutineBottomNav mainTab="calendar" onSelectTab={onSelectTab} />);

    expect(
      screen.getByRole("navigation", { name: "Розділи Рутини" }),
    ).toBeInTheDocument();
    const statsTab = screen.getByRole("tab", { name: /Статистика/i });
    fireEvent.click(statsTab);
    expect(onSelectTab).toHaveBeenCalledWith("stats");
  });

  it("does not render a Settings tab (settings moved to Hub Settings)", () => {
    render(<RoutineBottomNav mainTab="calendar" onSelectTab={() => {}} />);
    expect(
      screen.queryByRole("tab", { name: /Налаштування/i }),
    ).not.toBeInTheDocument();
  });
});
