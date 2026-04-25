// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useDialogFocusTrap } from "./useDialogFocusTrap";

/**
 * Spec: restoring focus to the dialog trigger on close is a WCAG 2.4.3
 * requirement. These tests lock the behavior in so future refactors
 * don't silently regress to dropping focus on <body>.
 */
describe("useDialogFocusTrap — focus restoration", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns focus to the previously-focused element when the trap closes", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const panel = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "Inside";
    panel.appendChild(inner);
    document.body.appendChild(panel);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, "current", { value: panel, writable: true });

    const { rerender, unmount } = renderHook(
      ({ open }) => useDialogFocusTrap(open, ref),
      { initialProps: { open: true } },
    );

    // Simulate the app moving focus into the dialog while it is open.
    inner.focus();
    expect(document.activeElement).toBe(inner);

    rerender({ open: false });

    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  it("does not throw when the trigger has unmounted before close", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const panel = document.createElement("div");
    document.body.appendChild(panel);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, "current", { value: panel, writable: true });

    const { rerender, unmount } = renderHook(
      ({ open }) => useDialogFocusTrap(open, ref),
      { initialProps: { open: true } },
    );

    // Trigger disappears while dialog is open.
    trigger.remove();

    expect(() => rerender({ open: false })).not.toThrow();
    unmount();
  });

  it("does not yank focus out of the dialog when onEscape identity changes while open", () => {
    // Regression: putting `onEscape` in the effect deps caused every
    // parent re-render (which creates a new inline arrow) to tear down
    // the trap and run the focus-restore cleanup, stealing focus from
    // inside the open dialog back to the trigger.
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const panel = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "Inside";
    panel.appendChild(inner);
    document.body.appendChild(panel);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, "current", { value: panel, writable: true });

    const { rerender, unmount } = renderHook(
      ({ onEscape }: { onEscape: () => void }) =>
        useDialogFocusTrap(true, ref, { onEscape }),
      { initialProps: { onEscape: () => {} } },
    );

    // User has tabbed into the dialog.
    inner.focus();
    expect(document.activeElement).toBe(inner);

    // Parent re-renders with a new inline arrow — dialog is still open.
    rerender({ onEscape: () => {} });

    // Focus must NOT have been yanked out to the trigger.
    expect(document.activeElement).toBe(inner);
    unmount();
  });

  it("uses the latest onEscape callback when Escape is pressed", () => {
    const panel = document.createElement("div");
    document.body.appendChild(panel);
    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, "current", { value: panel, writable: true });

    const first = { called: 0 };
    const second = { called: 0 };

    const { rerender, unmount } = renderHook(
      ({ onEscape }: { onEscape: () => void }) =>
        useDialogFocusTrap(true, ref, { onEscape }),
      { initialProps: { onEscape: () => first.called++ } },
    );

    rerender({ onEscape: () => second.called++ });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(first.called).toBe(0);
    expect(second.called).toBe(1);
    unmount();
  });

  it("does not attempt to restore focus to <body>", () => {
    document.body.focus();
    expect(document.activeElement).toBe(document.body);

    const panel = document.createElement("div");
    document.body.appendChild(panel);
    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, "current", { value: panel, writable: true });

    const { rerender, unmount } = renderHook(
      ({ open }) => useDialogFocusTrap(open, ref),
      { initialProps: { open: true } },
    );

    const inner = document.createElement("input");
    panel.appendChild(inner);
    inner.focus();
    expect(document.activeElement).toBe(inner);

    rerender({ open: false });

    // No recorded trigger → focus is not yanked back to body-level;
    // whatever was focused at close time (here: nothing meaningful)
    // is left alone.
    expect(document.activeElement).not.toBe(document.body);
    unmount();
  });
});
