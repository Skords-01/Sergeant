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
    const settingsTab = screen.getByRole("tab", { name: /Налаштування/i });
    fireEvent.click(settingsTab);
    expect(onSelectTab).toHaveBeenCalledWith("settings");
  });
});
