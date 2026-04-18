import { forwardRef } from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Button Component
 *
 * Variants:
 * - primary: Main CTA, emerald brand color
 * - secondary: Secondary actions, outlined
 * - ghost: Minimal, text-only actions
 * - danger: Destructive actions
 * - success: Confirmation actions
 *
 * Module-specific variants:
 * - finyk: Emerald finance theme
 * - fizruk: Teal fitness theme
 * - routine: Coral habit theme
 * - nutrition: Lime nutrition theme
 */

const variants = {
  // Core variants
  primary:
    "bg-brand-500 text-white shadow-sm hover:bg-brand-600 hover:shadow-glow active:bg-brand-700 active:scale-[0.98]",
  secondary:
    "bg-panel text-text border border-line shadow-sm hover:bg-panelHi hover:border-brand-200 active:scale-[0.98]",
  ghost:
    "bg-transparent text-muted hover:bg-panelHi hover:text-text active:bg-line/50",
  danger:
    "bg-red-50 text-red-600 border border-red-200/50 hover:bg-red-100 hover:border-red-300 active:scale-[0.98]",
  success:
    "bg-brand-50 text-brand-700 border border-brand-200/50 hover:bg-brand-100 active:scale-[0.98]",

  // Module-specific branded buttons
  finyk:
    "bg-finyk text-white shadow-sm hover:bg-finyk-hover hover:shadow-glow active:scale-[0.98]",
  fizruk:
    "bg-fizruk text-white shadow-sm hover:bg-fizruk-hover hover:shadow-glow-teal active:scale-[0.98]",
  routine:
    "bg-routine text-white shadow-sm hover:bg-routine-hover hover:shadow-glow-coral active:scale-[0.98]",
  nutrition:
    "bg-nutrition text-white shadow-sm hover:bg-nutrition-hover hover:shadow-glow-lime active:scale-[0.98]",

  // Soft module variants (for secondary actions within modules)
  "finyk-soft":
    "bg-finyk-soft text-finyk border border-finyk-ring/50 hover:bg-brand-100 active:scale-[0.98]",
  "fizruk-soft":
    "bg-fizruk-soft text-fizruk border border-fizruk-ring/50 hover:bg-teal-100 active:scale-[0.98]",
  "routine-soft":
    "bg-routine-surface text-routine border border-routine-ring/50 hover:bg-coral-100 active:scale-[0.98]",
  "nutrition-soft":
    "bg-nutrition-soft text-nutrition border border-nutrition-ring/50 hover:bg-lime-100 active:scale-[0.98]",
};

const sizes = {
  xs: "h-8 px-3 text-xs font-medium rounded-xl gap-1.5",
  sm: "h-9 px-3.5 text-sm font-medium rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm font-semibold rounded-2xl gap-2",
  lg: "h-12 px-6 text-base font-semibold rounded-2xl gap-2",
  xl: "h-14 px-8 text-base font-bold rounded-3xl gap-2.5",
};

// Icon-only button sizes
const iconSizes = {
  xs: "h-8 w-8 rounded-xl",
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-2xl",
  lg: "h-12 w-12 rounded-2xl",
  xl: "h-14 w-14 rounded-3xl",
};

export const Button = forwardRef(function Button(
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
        "transition-all duration-200 ease-smooth",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
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
          <LoadingSpinner className="animate-spin" aria-hidden="true" />
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
});

// Loading spinner component
function LoadingSpinner({ className }) {
  return (
    <svg
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
