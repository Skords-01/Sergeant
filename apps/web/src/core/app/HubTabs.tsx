import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import type { HubView } from "../hooks/useHubUIState";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  iconName?: string;
  iconBody?: ReactNode;
}

function TabButton({
  active,
  onClick,
  children,
  iconName,
  iconBody,
}: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 min-h-[44px] py-2 rounded-xl text-sm font-medium transition-[background-color,color,opacity]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
        active
          ? "bg-panel text-text shadow-card"
          : "text-muted hover:text-text",
      )}
    >
      {iconName ? <Icon name={iconName} size={15} strokeWidth={2} /> : iconBody}
      {children}
    </button>
  );
}

// "dashboard" icon is bespoke (2x2 grid of squares) so we render it inline
// here rather than adding a one-off entry to the shared Icon map.
function DashboardIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

interface HubTabsProps {
  hubView: HubView;
  onChange: (view: HubView) => void;
  /**
   * «Звіти» прибрана з tab-strip-а, поки у користувача немає жодного
   * реального запису. Порожній звіт — найгірший FTUX-стан: юзер тапне,
   * побачить «— ₴» і втратить довіру до модуля. Тому tab з'являється
   * лише коли `hasAnyRealEntry()` повертає `true` (див. `firstRealEntry.ts`).
   */
  showReports?: boolean;
}

export function HubTabs({
  hubView,
  onChange,
  showReports = true,
}: HubTabsProps) {
  return (
    <nav
      aria-label="Розділи хабу"
      className="px-5 max-w-lg mx-auto w-full mb-1"
    >
      <div
        role="tablist"
        className="flex rounded-2xl overflow-hidden border border-line bg-panelHi/40 p-0.5 gap-0.5"
      >
        <TabButton
          active={hubView === "dashboard"}
          onClick={() => onChange("dashboard")}
          iconBody={<DashboardIcon />}
        >
          Головна
        </TabButton>

        {showReports && (
          <TabButton
            active={hubView === "reports"}
            onClick={() => onChange("reports")}
            iconName="bar-chart"
          >
            Звіти
          </TabButton>
        )}

        <TabButton
          active={hubView === "settings"}
          onClick={() => onChange("settings")}
          iconName="settings"
        >
          Налаштування
        </TabButton>
      </div>
    </nav>
  );
}
