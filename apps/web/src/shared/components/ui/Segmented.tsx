import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Sergeant Design System — Segmented
 *
 * Pill-style segmented control for mode/tab switching inside a page.
 * Consolidates the drift between Fizruk Workouts (solid module-fill tabs)
 * and Routine calendar time-mode chips (soft tinted chips).
 *
 * Not intended to replace `<SubTabs>` (full-width bar-style) — that
 * pattern is a separate variant kept in its own component for now.
 */

export type SegmentedAccent =
  | "brand"
  | "fizruk"
  | "routine"
  | "nutrition"
  | "finyk";
export type SegmentedTone = "solid" | "soft";
export type SegmentedSize = "sm" | "md";

export interface SegmentedItem<V extends string = string> {
  value: V;
  label: ReactNode;
  title?: string;
  ariaLabel?: string;
}

export interface SegmentedProps<V extends string = string> {
  items: ReadonlyArray<SegmentedItem<V>>;
  value: V;
  onChange: (value: V) => void;
  /** "solid" = filled accent background (used in Fizruk Workouts tabs).
   *  "soft"  = tinted surface + accent border + accent text (Routine chips). */
  tone?: SegmentedTone;
  /** "sm" ≈ 36px min-height; "md" = 44px min-height (touch target). */
  size?: SegmentedSize;
  accent?: SegmentedAccent;
  /** Accessible label for the underlying role="tablist". */
  ariaLabel?: string;
  className?: string;
}

const ACCENT_SOLID: Record<SegmentedAccent, string> = {
  brand: "bg-brand text-white border-brand",
  fizruk: "bg-fizruk text-white border-fizruk",
  routine: "bg-routine text-white border-routine",
  nutrition: "bg-nutrition text-white border-nutrition",
  finyk: "bg-finyk text-white border-finyk",
};

const ACCENT_SOFT: Record<SegmentedAccent, string> = {
  brand:
    "border-brand-200 bg-brand-50 text-brand-700 shadow-sm dark:border-brand/40 dark:bg-brand/15 dark:text-brand",
  fizruk:
    "border-fizruk-ring bg-fizruk-surface text-fizruk-strong shadow-sm dark:border-fizruk-border-dark/40 dark:bg-fizruk-surface-dark/15 dark:text-fizruk",
  routine:
    "border-routine-ring bg-routine-surface text-routine-strong shadow-sm dark:border-routine-border-dark/40 dark:bg-routine-surface-dark/15 dark:text-routine",
  nutrition:
    "border-nutrition-ring bg-nutrition-surface text-nutrition-strong shadow-sm dark:border-nutrition-border-dark/40 dark:bg-nutrition-surface-dark/15 dark:text-nutrition",
  finyk:
    "border-finyk-ring bg-finyk-surface text-finyk-strong shadow-sm dark:border-finyk-border-dark/40 dark:bg-finyk-surface-dark/15 dark:text-finyk",
};

const INACTIVE =
  "border-line bg-panel text-muted hover:text-text hover:bg-panelHi transition-colors";

const SIZE: Record<SegmentedSize, string> = {
  sm: "px-3 py-2 text-xs min-h-[36px]",
  md: "px-3 py-2.5 text-xs min-h-[44px]",
};

export function Segmented<V extends string = string>({
  items,
  value,
  onChange,
  tone = "soft",
  size = "md",
  accent = "brand",
  ariaLabel,
  className,
}: SegmentedProps<V>) {
  const activeClass =
    tone === "solid" ? ACCENT_SOLID[accent] : ACCENT_SOFT[accent];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={item.ariaLabel}
            title={item.title}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-full border font-semibold transition-[background-color,border-color,color,box-shadow,opacity]",
              SIZE[size],
              isActive ? activeClass : INACTIVE,
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
