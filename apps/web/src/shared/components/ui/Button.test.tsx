/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { afterEach } from "vitest";
import { Button } from "./Button";

afterEach(cleanup);

/**
 * Smoke-level contract tests for the DS Button primitive. These lock the
 * publicly visible behaviour (disabled ⇄ loading, sr-only loading label,
 * forwardRef, type="button" default) so future refactors don't silently
 * regress consumers that rely on them.
 */
describe("Button", () => {
  it("renders children and defaults to type='button' (not 'submit')", () => {
    const { getByRole } = render(<Button>Зберегти</Button>);
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.textContent).toBe("Зберегти");
    expect(btn.type).toBe("button");
  });

  it("is disabled and aria-busy when loading=true, even without disabled prop", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button loading onClick={onClick}>
        Зберегти
      </Button>,
    );
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("exposes an sr-only 'Завантаження…' label while loading", () => {
    const { getByText } = render(<Button loading>Зберегти</Button>);
    const sr = getByText("Завантаження…");
    expect(sr.className).toContain("sr-only");
  });

  it("forwards ref to the native <button> element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ok</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Ok");
  });

  it("applies variant classes (primary → bg-brand-500)", () => {
    const { getByRole } = render(<Button variant="primary">Go</Button>);
    expect(getByRole("button").className).toContain("bg-brand-500");
  });

  it("applies size classes distinctly for md vs xs", () => {
    const { getByRole, rerender } = render(<Button size="xs">X</Button>);
    expect(getByRole("button").className).toMatch(/\bh-8\b/);
    rerender(<Button size="md">X</Button>);
    expect(getByRole("button").className).toMatch(/\bh-11\b/);
  });

  it("uses iconSizes (square) when iconOnly=true", () => {
    const { getByRole } = render(
      <Button iconOnly size="md" aria-label="close">
        ✕
      </Button>,
    );
    const cls = getByRole("button").className;
    // h-11 w-11 rather than h-11 px-5
    expect(cls).toMatch(/\bh-11\b/);
    expect(cls).toMatch(/\bw-11\b/);
  });
});
