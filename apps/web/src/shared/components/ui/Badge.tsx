import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Sergeant Design System — Badge
 *
 * Compact pill for status, counts and labels. Pairs with `Card` /
 * `SectionHeading` titles and stat rows. Variants use the semantic /
 * brand tokens (`accent` / `success` / `warning` / `danger` / `info`)
 * plus the four module brand colours, so dark mode works automatically.
 *
 * Tones:
 *   - `soft`  — tinted bg + accent fg + accent border (default)
 *   - `solid` — filled accent bg + white fg (high-emphasis)
 *   - `outline` — transparent bg + accent border + accent fg
 */

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition";

export type BadgeTone = "soft" | "solid" | "outline";

export type BadgeSize = "xs" | "sm" | "md";

const solidVariants: Record<BadgeVariant, string> = {
  neutral: "bg-fg-muted/90 text-surface border-transparent",
  accent: "bg-accent text-white border-transparent",
  success: "bg-brand-700 text-white border-transparent",
  warning: "bg-warning text-white border-transparent",
  danger: "bg-danger text-white border-transparent",
  info: "bg-info text-white border-transparent",
  finyk: "bg-finyk text-white border-transparent",
  fizruk: "bg-fizruk text-white border-transparent",
  routine: "bg-routine text-white border-transparent",
  nutrition: "bg-nutrition text-white border-transparent",
};

const softVariants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-fg-muted border-line",
  accent:
    "bg-brand-50 text-brand-700 border-brand-200/60 dark:bg-brand/15 dark:text-brand dark:border-brand/30",
  success:
    "bg-brand-50 text-brand-700 border-brand-200/60 dark:bg-brand/15 dark:text-brand dark:border-brand/30",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  danger:
    "bg-danger-soft text-danger border-danger/30 dark:bg-danger/15 dark:border-danger/30",
  info: "bg-blue-50 text-blue-700 border-blue-200/70 dark:bg-info/15 dark:text-blue-300 dark:border-info/30",
  finyk:
    "bg-finyk-soft text-finyk-strong border-finyk-ring/50 dark:bg-finyk/15 dark:text-finyk dark:border-finyk/30",
  fizruk:
    "bg-fizruk-soft text-fizruk-strong border-fizruk-ring/50 dark:bg-fizruk/15 dark:text-fizruk dark:border-fizruk/30",
  routine:
    "bg-routine-surface text-routine-strong border-routine-ring/50 dark:bg-routine/15 dark:text-routine dark:border-routine/30",
  nutrition:
    "bg-nutrition-soft text-nutrition-strong border-nutrition-ring/50 dark:bg-nutrition/15 dark:text-nutrition dark:border-nutrition/30",
};

const outlineVariants: Record<BadgeVariant, string> = {
  neutral: "border-line text-fg-muted bg-transparent",
  accent: "border-accent/60 text-accent bg-transparent",
  success: "border-success/60 text-success bg-transparent",
  warning: "border-warning/60 text-warning bg-transparent",
  danger: "border-danger/60 text-danger bg-transparent",
  info: "border-info/60 text-info bg-transparent",
  finyk: "border-finyk/60 text-finyk bg-transparent",
  fizruk: "border-fizruk/60 text-fizruk bg-transparent",
  routine: "border-routine/60 text-routine bg-transparent",
  nutrition: "border-nutrition/60 text-nutrition bg-transparent",
};

const sizes: Record<BadgeSize, string> = {
  xs: "h-5 px-1.5 text-2xs gap-1 rounded-md",
  sm: "h-6 px-2 text-xs gap-1 rounded-lg",
  md: "h-7 px-2.5 text-xs gap-1.5 rounded-xl",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading dot (useful for status indicators). */
  dot?: boolean;
  children?: ReactNode;
}

export function Badge({
  variant = "neutral",
  tone = "soft",
  size = "sm",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const toneMap =
    tone === "solid"
      ? solidVariants
      : tone === "outline"
        ? outlineVariants
        : softVariants;

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold border whitespace-nowrap",
        sizes[size],
        toneMap[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-current shrink-0"
        />
      )}
      {children}
    </span>
  );
}
