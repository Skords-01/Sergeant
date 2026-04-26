/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { Badge } from "./Badge";

afterEach(cleanup);

/**
 * Contract tests for the DS Badge primitive. Locks tone × variant wiring
 * and verifies the optional leading dot is rendered as aria-hidden.
 */
describe("Badge", () => {
  it("defaults to tone='soft' + variant='neutral'", () => {
    const { container } = render(<Badge>42</Badge>);
    const el = container.querySelector("span")!;
    // neutral-soft uses bg-surface-muted
    expect(el.className).toContain("bg-surface-muted");
    expect(el.className).toContain("text-fg-muted");
  });

  it("solid tone uses saturated accent + white text for variant='success'", () => {
    const { container } = render(
      <Badge tone="solid" variant="success">
        OK
      </Badge>,
    );
    const el = container.querySelector("span")!;
    expect(el.className).toContain("bg-brand-700");
    expect(el.className).toContain("text-white");
  });

  it("outline tone drops bg and keeps accent border for variant='finyk'", () => {
    const { container } = render(
      <Badge tone="outline" variant="finyk">
        ФІНІК
      </Badge>,
    );
    const el = container.querySelector("span")!;
    expect(el.className).toContain("bg-transparent");
    expect(el.className).toContain("text-finyk");
    expect(el.className).toContain("border-finyk/60");
  });

  it("renders an aria-hidden dot when dot=true", () => {
    const { container } = render(<Badge dot>Live</Badge>);
    const dot = container.querySelector("span > span[aria-hidden]");
    expect(dot).not.toBeNull();
    expect(dot!.className).toContain("rounded-full");
  });

  it("does not render a dot when dot is omitted (default)", () => {
    const { container } = render(<Badge>Idle</Badge>);
    const dot = container.querySelector("span > span[aria-hidden]");
    expect(dot).toBeNull();
  });

  it("maps size='xs' to text-2xs and size='md' to text-xs", () => {
    const { container, rerender } = render(<Badge size="xs">x</Badge>);
    expect(container.querySelector("span")!.className).toContain("text-2xs");
    rerender(<Badge size="md">x</Badge>);
    expect(container.querySelector("span")!.className).toContain("text-xs");
  });
});
