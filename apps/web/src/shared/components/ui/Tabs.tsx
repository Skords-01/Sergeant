import {
  useCallback,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@shared/lib/cn";

/**
 * Sergeant Design System — Tabs
 *
 * Accessible tablist with full keyboard support (ArrowLeft/ArrowRight,
 * Home/End, Enter/Space). Use for switching *between pages of content*
 * that should be addressable by URL-ish state.
 *
 * When to use what:
 *   - `Tabs`     — primary page-level or section-level navigation between
 *                  bodies of content. Renders role="tablist" with arrow-key
 *                  navigation, supports controlled panels.
 *   - `Segmented`— compact mode/view switcher (chips). No panels, shorter.
 *
 * Tones:
 *   - `underline` — minimal underline under active tab (default)
 *   - `pill`      — soft tinted pill background on active tab
 */

export type TabsTone = "underline" | "pill";

export type TabsAccent = "brand" | "finyk" | "fizruk" | "routine" | "nutrition";

export type TabsSize = "sm" | "md";

export interface TabItem<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** Optional badge/count suffix. */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<V extends string = string> {
  items: ReadonlyArray<TabItem<V>>;
  value: V;
  onChange: (value: V) => void;
  tone?: TabsTone;
  accent?: TabsAccent;
  size?: TabsSize;
  /** Stretch tabs to fill the container width. */
  fill?: boolean;
  /** Accessible label for the tablist. */
  ariaLabel?: string;
  className?: string;
  tabsClassName?: string;
}

const ACCENT_TEXT: Record<TabsAccent, string> = {
  brand: "text-brand",
  finyk: "text-finyk",
  fizruk: "text-fizruk",
  routine: "text-routine",
  nutrition: "text-nutrition",
};

const ACCENT_UNDERLINE: Record<TabsAccent, string> = {
  brand: "border-brand",
  finyk: "border-finyk",
  fizruk: "border-fizruk",
  routine: "border-routine",
  nutrition: "border-nutrition",
};

const ACCENT_PILL: Record<TabsAccent, string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand/15 dark:text-brand",
  finyk: "bg-finyk-soft text-finyk-strong dark:bg-finyk/15 dark:text-finyk",
  fizruk:
    "bg-fizruk-soft text-fizruk-strong dark:bg-fizruk/15 dark:text-fizruk",
  routine:
    "bg-routine-surface text-routine-strong dark:bg-routine/15 dark:text-routine",
  nutrition:
    "bg-nutrition-soft text-nutrition-strong dark:bg-nutrition/15 dark:text-nutrition",
};

const ACCENT_RING: Record<TabsAccent, string> = {
  brand: "focus-visible:ring-brand-500/45",
  finyk: "focus-visible:ring-finyk/45",
  fizruk: "focus-visible:ring-fizruk/45",
  routine: "focus-visible:ring-routine/45",
  nutrition: "focus-visible:ring-nutrition/45",
};

const SIZE: Record<TabsSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
};

export function Tabs<V extends string = string>({
  items,
  value,
  onChange,
  tone = "underline",
  accent = "brand",
  size = "md",
  fill = false,
  ariaLabel,
  className,
  tabsClassName,
}: TabsProps<V>) {
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const focusTabByOffset = useCallback(
    (currentIndex: number, offset: number) => {
      const el = listRef.current;
      if (!el) return;
      const buttons = Array.from(
        el.querySelectorAll<HTMLButtonElement>(
          'button[role="tab"]:not([disabled])',
        ),
      );
      if (buttons.length === 0) return;
      const enabled = items.filter((i) => !i.disabled);
      const currentVal = items[currentIndex]?.value;
      const enabledIdx = enabled.findIndex((i) => i.value === currentVal);
      const nextIdx = (enabledIdx + offset + enabled.length) % enabled.length;
      const next = enabled[nextIdx];
      if (!next) return;
      const nextBtn = buttons.find(
        (b) => b.dataset.value === String(next.value),
      );
      nextBtn?.focus();
      onChange(next.value);
    },
    [items, onChange],
  );

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTabByOffset(index, 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTabByOffset(index, -1);
        break;
      case "Home":
        event.preventDefault();
        focusTabByOffset(-1, 1);
        break;
      case "End":
        event.preventDefault();
        focusTabByOffset(items.length, -1);
        break;
      default:
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-stretch",
        tone === "underline"
          ? "gap-1 border-b border-line"
          : "gap-1 p-1 rounded-2xl bg-surface-muted",
        fill && "w-full",
        className,
      )}
    >
      {items.map((item, index) => {
        const isActive = item.value === value;
        const commonClasses = cn(
          "inline-flex items-center justify-center gap-2 font-semibold",
          "transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          ACCENT_RING[accent],
          SIZE[size],
          fill && "flex-1 min-w-0",
          item.disabled && "opacity-50 cursor-not-allowed",
        );

        const toneClasses =
          tone === "underline"
            ? cn(
                "rounded-none border-b-2 -mb-px",
                isActive
                  ? cn(ACCENT_UNDERLINE[accent], ACCENT_TEXT[accent])
                  : "border-transparent text-fg-muted hover:text-fg",
              )
            : cn(
                "rounded-xl",
                isActive
                  ? ACCENT_PILL[accent]
                  : "text-fg-muted hover:text-fg hover:bg-surface",
              );

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.value}`}
            data-value={String(item.value)}
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(commonClasses, toneClasses, tabsClassName)}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  /** Tab value this panel corresponds to. */
  value: string;
  /** Current active tab value. */
  active: string;
  /** Same `ariaLabel` key used on the Tabs — optional; when omitted, panel
   *  still gets correct tabpanel role without id-wiring. Pass the same
   *  `baseId` used internally if you want full aria-controls wiring. */
  baseId?: string;
  /** Keep panel mounted even when not active (preserves state). */
  keepMounted?: boolean;
  children?: ReactNode;
  className?: string;
}

export function TabPanel({
  value,
  active,
  baseId,
  keepMounted = false,
  children,
  className,
}: TabPanelProps) {
  const isActive = value === active;
  if (!isActive && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={baseId ? `${baseId}-panel-${value}` : undefined}
      aria-labelledby={baseId ? `${baseId}-tab-${value}` : undefined}
      hidden={!isActive}
      className={className}
    >
      {children}
    </div>
  );
}
