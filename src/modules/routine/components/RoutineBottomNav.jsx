import { cn } from "@shared/lib/cn";
import { ROUTINE_THEME as C } from "../lib/routineConstants.js";

const NAV = [
  {
    id: "calendar",
    label: "Календар",
    panelId: "routine-panel-calendar",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "stats",
    label: "Статистика",
    panelId: "routine-panel-stats",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="6" y1="20" x2="6" y2="12" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="18" y1="20" x2="18" y2="9" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Налаштування",
    panelId: "routine-panel-settings",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export function RoutineBottomNav({ mainTab, onSelectTab }) {
  return (
    <nav
      className={cn(
        "shrink-0 relative z-30 safe-area-pb",
        "bg-panel/95 backdrop-blur-xl",
        "border-t border-line/60",
      )}
      aria-label="Розділи Рутини"
    >
      <div className="flex h-[60px]" role="tablist">
        {NAV.map((item) => {
          const active = mainTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`routine-tab-${item.id}`}
              aria-selected={active}
              aria-controls={item.panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelectTab(item.id)}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1.5",
                "transition-all duration-200 min-h-[48px]",
                "active:scale-95",
                active ? "text-text" : "text-muted hover:text-text/70",
              )}
            >
              {/* Active indicator pill */}
              {active && (
                <span
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2",
                    "w-10 h-1 rounded-full",
                    "bg-gradient-to-r from-coral-400 to-coral-500",
                    "shadow-sm",
                  )}
                  aria-hidden
                />
              )}

              {/* Icon with glow effect when active */}
              <span
                className={cn(
                  "transition-all duration-200",
                  active && C.navActive,
                  active && "drop-shadow-[0_0_8px_rgba(249,112,102,0.3)]",
                )}
                aria-hidden
              >
                {item.icon}
              </span>

              <span
                className={cn(
                  "text-[11px] leading-none font-semibold transition-colors",
                  active ? "text-text" : "text-muted",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
