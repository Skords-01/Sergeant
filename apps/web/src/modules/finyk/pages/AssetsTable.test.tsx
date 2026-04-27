// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssetsNetworthCard } from "./AssetsTable";

describe("AssetsNetworthCard", () => {
  it("renders networth header when showBalance is true", () => {
    render(
      <AssetsNetworthCard
        networth={12345}
        totalAssets={15000}
        totalDebt={2655}
        showBalance={true}
      />,
    );
    expect(screen.getByText("Загальний нетворс")).toBeInTheDocument();
  });

  it("shows 'Суми приховано' when showBalance is false", () => {
    render(
      <AssetsNetworthCard
        networth={12345}
        totalAssets={15000}
        totalDebt={2655}
        showBalance={false}
      />,
    );
    expect(screen.getByText("Суми приховано")).toBeInTheDocument();
  });

  it("renders assets/liabilities bar when both > 0 and showBalance", () => {
    const { container } = render(
      <AssetsNetworthCard
        networth={12345}
        totalAssets={15000}
        totalDebt={2655}
        showBalance={true}
      />,
    );
    const bar = container.querySelector('[role="img"]');
    expect(bar).toBeInTheDocument();
  });

  it("does not render bar when totalAssets + totalDebt = 0", () => {
    const { container } = render(
      <AssetsNetworthCard
        networth={0}
        totalAssets={0}
        totalDebt={0}
        showBalance={true}
      />,
    );
    const bars = container.querySelectorAll('[role="img"]');
    const nonLucideBars = Array.from(bars).filter((el) => !el.closest("svg"));
    expect(nonLucideBars.length).toBe(0);
  });
});
