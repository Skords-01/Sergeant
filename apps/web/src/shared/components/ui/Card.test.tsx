/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { afterEach } from "vitest";
import { Card } from "./Card";

afterEach(cleanup);

/**
 * Contract tests for the DS Card primitive. Locks the radius/variant
 * interaction: core variants honour the `radius` prop, module-branded
 * variants bake rounded-3xl (so the `radius` prop is ignored for them).
 */
describe("Card", () => {
  it("defaults: variant='default', radius='xl', padding='md'", () => {
    const { container } = render(<Card>body</Card>);
    const el = container.firstElementChild!;
    expect(el.className).toContain("bg-panel");
    expect(el.className).toContain("border-line");
    expect(el.className).toContain("rounded-3xl");
    expect(el.className).toContain("p-4");
  });

  it("applies radius='lg' (rounded-2xl) on core variants", () => {
    const { container } = render(
      <Card variant="default" radius="lg">
        x
      </Card>,
    );
    expect(container.firstElementChild!.className).toContain("rounded-2xl");
  });

  it("ignores `radius` on branded variants (radius is baked into the variant class)", () => {
    const { container } = render(
      <Card variant="finyk" radius="md">
        hero
      </Card>,
    );
    const cls = container.firstElementChild!.className;
    // The branded variant hard-codes rounded-3xl and the radius prop must not
    // add a conflicting rounded-xl class.
    expect(cls).toContain("rounded-3xl");
    expect(cls).not.toContain("rounded-xl ");
  });

  it("accepts `as` to render a semantic element (e.g. <section>)", () => {
    const { container } = render(
      <Card as="section" aria-label="hero">
        x
      </Card>,
    );
    expect(container.firstElementChild!.tagName).toBe("SECTION");
  });

  it("forwards ref to the underlying element", () => {
    const ref = createRef<HTMLElement>();
    render(<Card ref={ref}>x</Card>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it("padding='none' emits no padding utility class", () => {
    const { container } = render(<Card padding="none">x</Card>);
    const cls = container.firstElementChild!.className;
    expect(cls).not.toMatch(/\bp-\d/);
  });
});
