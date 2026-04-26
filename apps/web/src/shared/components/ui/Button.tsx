import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Button Component
 *
 * Variants:
 * - primary: Main CTA, emerald brand color
 * - secondary: Secondary actions, outlined
 * - ghost: Minimal, text-only actions
 * - danger: Soft destructive affordance (red-tinted, for inline "Delete" chips)
 * - destructive: Solid destructive CTA (use for confirmation dialogs / primary delete buttons)
 * - success: Confirmation actions
 *
 * Module-specific variants:
 * - finyk: Emerald finance theme
 * - fizruk: Teal fitness theme
 * - routine: Coral habit theme
 * - nutrition: Lime nutrition theme
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "destructive"
  | "success"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition"
  | "finyk-soft"
  | "fizruk-soft"
  | "routine-soft"
  | "nutrition-soft";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

const variants: Record<ButtonVariant, string> = {
  // Core variants
  // `bg-brand-strong` = emerald-700 (5.48:1 vs text-white) — clears WCAG
  // AA at body sizes. Saturated `bg-brand-500` failed at ~2.5:1; see
  // docs/brand-palette-wcag-aa-proposal.md § 2.2.
  primary:
    "bg-brand-strong text-white shadow-sm hover:bg-brand-800 hover:shadow-glow active:bg-brand-900 active:scale-[0.98]",
  secondary:
    "bg-panel text-text border border-line shadow-sm hover:bg-panelHi hover:border-brand-200 active:scale-[0.98]",
  ghost:
    "bg-transparent text-muted hover:bg-panelHi hover:text-text active:bg-line/50",
  danger:
    "bg-danger-soft text-danger-strong border border-danger/30 hover:bg-danger/15 hover:border-danger/50 active:scale-[0.98]",
  destructive:
    "bg-danger-strong text-white shadow-sm hover:brightness-110 hover:shadow-danger-ring active:scale-[0.98]",
  success:
    "bg-brand-50 text-brand-700 border border-brand-200/50 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30 dark:hover:bg-brand-500/25 active:scale-[0.98]",

  // Module-specific branded buttons. `bg-{module}-strong` = the
  // module's `[700]` (or lime-800 for nutrition) — clears WCAG AA on
  // text-white (5.0–7.0:1). Hover stays at the existing `*-hover`
  // shade (= brand-600) which is one step *lighter* than the new base;
  // that’s the same hover-on-pressed pattern Apple/Material use for
  // dark CTAs.
  finyk:
    "bg-finyk-strong text-white shadow-sm hover:bg-finyk-hover hover:shadow-glow active:scale-[0.98]",
  fizruk:
    "bg-fizruk-strong text-white shadow-sm hover:bg-fizruk-hover hover:shadow-glow-teal active:scale-[0.98]",
  routine:
    "bg-routine-strong text-white shadow-sm hover:bg-routine-hover hover:shadow-glow-coral active:scale-[0.98]",
  nutrition:
    "bg-nutrition-strong text-white shadow-sm hover:bg-nutrition-hover hover:shadow-glow-lime active:scale-[0.98]",

  // Soft module variants (for secondary actions within modules).
  // Dark mode swaps the light pastel surface for the saturated accent at
  // low opacity so the button blends with the warm dark panel instead of
  // reading as an acidic pastel — same convention used by Badge/Tabs.
  "finyk-soft":
    "bg-finyk-soft text-finyk-strong dark:bg-finyk-surface-dark/15 dark:text-finyk border border-finyk-ring/50 dark:border-finyk-border-dark/30 hover:bg-brand-100 dark:hover:bg-finyk-surface-dark/25 active:scale-[0.98]",
  "fizruk-soft":
    "bg-fizruk-soft text-fizruk-strong dark:bg-fizruk-surface-dark/15 dark:text-fizruk border border-fizruk-ring/50 dark:border-fizruk-border-dark/30 hover:bg-teal-100 dark:hover:bg-fizruk-surface-dark/25 active:scale-[0.98]",
  "routine-soft":
    "bg-routine-surface text-routine-strong dark:bg-routine-surface-dark/15 dark:text-routine border border-routine-ring/50 dark:border-routine-border-dark/30 hover:bg-coral-100 dark:hover:bg-routine-surface-dark/25 active:scale-[0.98]",
  "nutrition-soft":
    "bg-nutrition-soft text-nutrition-strong dark:bg-nutrition-surface-dark/15 dark:text-nutrition border border-nutrition-ring/50 dark:border-nutrition-border-dark/30 hover:bg-lime-100 dark:hover:bg-nutrition-surface-dark/25 active:scale-[0.98]",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 px-3 text-xs font-medium rounded-xl gap-1.5",
  sm: "h-9 px-3.5 text-sm font-medium rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm font-semibold rounded-2xl gap-2",
  lg: "h-12 px-6 text-base font-semibold rounded-2xl gap-2",
  xl: "h-14 px-8 text-base font-bold rounded-3xl gap-2.5",
};

// Icon-only button sizes
const iconSizes: Record<ButtonSize, string> = {
  xs: "h-8 w-8 rounded-xl",
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-2xl",
  lg: "h-12 w-12 rounded-2xl",
  xl: "h-14 w-14 rounded-3xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      iconOnly = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-live={loading ? "polite" : undefined}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center",
          "transition-interactive",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          // Variant
          variants[variant],
          // Size
          iconOnly ? iconSizes[size] : sizes[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <LoadingSpinner className="motion-safe:animate-spin" />
            {!iconOnly && (
              <span className="opacity-0" aria-hidden="true">
                {children}
              </span>
            )}
            <span className="sr-only">Завантаження…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

// Loading spinner component. Always decorative — SR announcement is handled by
// the sr-only "Завантаження…" sibling in Button.
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
