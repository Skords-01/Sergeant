import { useEffect } from "react";

/**
 * Tab циклічно лишається в межах контейнера; Escape викликає onEscape.
 * @param {boolean} open
 * @param {React.RefObject<HTMLElement | null>} containerRef
 * @param {{ onEscape?: () => void }} [options]
 */
export function useDialogFocusTrap(open, containerRef, options = {}) {
  const { onEscape } = options;

  useEffect(() => {
    if (!open) return;
    const panel = containerRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true",
      );

    const onKeyDown = (e) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = getFocusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onEscape, containerRef]);
}
