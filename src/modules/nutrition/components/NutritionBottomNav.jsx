import { cn } from "@shared/lib/cn";

const NAV = [
  {
    id: "products",
    label: "Продукти",
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
      >
        <path d="M4 11c0 6 4 10 8 10s8-4 8-10" />
        <path d="M12 21V11" />
        <path d="M7 5c0 2 1 3 2 4M17 5c0 2-1 3-2 4" />
        <path d="M7 5c0-1 1-2 2-2s2 1 2 2c0 2-2 4-2 6" />
        <path d="M17 5c0-1-1-2-2-2s-2 1-2 2c0 2 2 4 2 6" />
      </svg>
    ),
  },
  {
    id: "recipes",
    label: "Рецепти",
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
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    ),
  },
];

export function NutritionBottomNav({ activePage, setActivePage, busy }) {
  return (
    <nav className="shrink-0 bg-panel/95 backdrop-blur-md border-t border-line/60 relative z-30 safe-area-pb">
      <div className="flex h-[58px]">
        {NAV.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
              disabled={busy}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1 transition-all min-h-[48px]",
                active ? "text-text" : "text-muted",
              )}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-9 h-0.5 rounded-full bg-nutrition"
                  aria-hidden
                />
              )}
              <span className={cn(active && "text-nutrition")}>{item.icon}</span>
              <span
                className={cn(
                  "text-[11px] leading-none font-semibold",
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
