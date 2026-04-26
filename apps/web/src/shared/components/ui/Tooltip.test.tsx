/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Tooltip", () => {
  it("does not render the tooltip panel when closed", () => {
    const { queryByRole } = render(
      <Tooltip content="Щоденний ліміт">
        <button type="button">Ліміт</button>
      </Tooltip>,
    );
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("opens on focus after the open delay and exposes aria-describedby", () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole } = render(
      <Tooltip content="Щоденний ліміт" openDelay={150}>
        <button type="button">Ліміт</button>
      </Tooltip>,
    );
    const btn = getByRole("button") as HTMLButtonElement;

    fireEvent.focus(btn);
    expect(queryByRole("tooltip")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    const panel = getByRole("tooltip");
    expect(panel).not.toBeNull();
    expect(panel.textContent).toBe("Щоденний ліміт");
    expect(btn.getAttribute("aria-describedby")).toBe(panel.id);
  });

  it("opens on mouseenter, closes on mouseleave", () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole } = render(
      <Tooltip content="Help" openDelay={100}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const btn = getByRole("button") as HTMLButtonElement;

    fireEvent.mouseEnter(btn);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryByRole("tooltip")).not.toBeNull();

    fireEvent.mouseLeave(btn);
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape key", () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole } = render(
      <Tooltip content="Help" openDelay={50}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const btn = getByRole("button") as HTMLButtonElement;

    fireEvent.focus(btn);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(queryByRole("tooltip")).not.toBeNull();

    fireEvent.keyDown(btn, { key: "Escape" });
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("does not open when disabled=true", () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole } = render(
      <Tooltip content="Help" disabled openDelay={50}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    fireEvent.focus(getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("preserves trigger's existing onClick / onKeyDown handlers", () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const { getByRole } = render(
      <Tooltip content="Help">
        <button type="button" onClick={onClick} onKeyDown={onKeyDown}>
          Trigger
        </button>
      </Tooltip>,
    );
    const btn = getByRole("button") as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
