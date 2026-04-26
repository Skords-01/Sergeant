// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayFocusCard } from "./TodayFocusCard";

describe("TodayFocusCard", () => {
  it("uses danger styling for over-budget recommendations", () => {
    const { container } = render(
      <TodayFocusCard
        focus={{
          id: "budget_over_smoking",
          module: "finyk",
          severity: "danger",
          icon: "💸",
          title: 'Бюджет "smoking" перевищено на 18%',
          body: "Витрачено 590 ₴ з 500 ₴",
          action: "finyk",
        }}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveClass(
      "bg-danger-soft/70",
      "border-danger/30",
    );
    expect(screen.getByText("Зараз")).toHaveClass("text-danger");
  });
});
