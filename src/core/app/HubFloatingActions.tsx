import { useEffect, useRef, useState } from "react";
import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";
import { openHubModuleWithAction } from "@shared/lib/hubNav";

/**
 * Cross-module "+ Додати" speed dial. Tapping the primary FAB reveals 4
 * contextual add actions — the shortest path from the hub to a real entry
 * in any module. Replaces the previous AI-chat-only FAB; the AI assistant
 * now lives in the header (see `HubHeader`).
 */
const ACTIONS = [
  {
    id: "expense",
    icon: "credit-card",
    label: "Витрата",
    accent: "text-finyk bg-finyk-soft",
    run: () => openHubModuleWithAction("finyk", "add_expense"),
  },
  {
    id: "meal",
    icon: "utensils",
    label: "Прийом їжі",
    accent: "text-nutrition bg-nutrition-soft",
    run: () => openHubModuleWithAction("nutrition", "add_meal"),
  },
  {
    id: "habit",
    icon: "check",
    label: "Звичка",
    accent: "text-routine bg-routine-soft",
    run: () => openHubModuleWithAction("routine", "add_habit"),
  },
  {
    id: "workout",
    icon: "dumbbell",
    label: "Тренування",
    accent: "text-fizruk bg-fizruk-soft",
    run: () => openHubModuleWithAction("fizruk", "start_workout"),
  },
];

export function HubFloatingActions() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Click-outside + Escape close. Matches the ambient dismissal pattern
  // used by the rest of the hub's popovers.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const runAction = (action) => {
    setOpen(false);
    action.run();
  };

  return (
    <div
      ref={rootRef}
      className="fixed right-5 z-40 flex flex-col items-end gap-2 pointer-events-none"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {open && (
        <div
          role="menu"
          aria-label="Швидке додавання"
          className="pointer-events-auto flex flex-col items-end gap-2 animate-fade-in"
        >
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => runAction(a)}
              className="group flex items-center gap-3 pl-3 pr-2 h-11 rounded-full bg-panel border border-line shadow-card hover:shadow-float transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
            >
              <span className="text-sm font-medium text-text whitespace-nowrap">
                {a.label}
              </span>
              <span
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  a.accent,
                )}
                aria-hidden
              >
                <Icon name={a.icon} size={16} strokeWidth={2} />
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Закрити меню додавання" : "Додати"}
        title="Додати"
        className={cn(
          "pointer-events-auto w-14 h-14 flex items-center justify-center rounded-full bg-brand-500 text-white shadow-float hover:bg-brand-600 hover:shadow-glow active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          open && "rotate-45",
        )}
      >
        <Icon name="plus" size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}
