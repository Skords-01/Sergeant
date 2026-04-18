import { forwardRef } from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Input Component
 *
 * Sizes: sm, md, lg
 * Variants: default, filled, ghost
 * States: error, success
 */

const sizes = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-base rounded-2xl",
  lg: "h-12 px-5 text-base rounded-2xl",
};

const variants = {
  default:
    "bg-panelHi border border-line focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
  filled: "bg-panelHi border-transparent focus:bg-panel focus:border-brand-400",
  ghost: "bg-transparent border-transparent hover:bg-panelHi focus:bg-panelHi",
};

export const Input = forwardRef(function Input(
  {
    className,
    size = "md",
    variant = "default",
    error,
    success,
    icon,
    suffix,
    ...props
  },
  ref,
) {
  const stateClass = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
    : success
      ? "border-brand-400 focus:border-brand-500 focus:ring-brand-100"
      : "";

  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full text-text placeholder:text-subtle/70",
          "outline-none transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          sizes[size],
          variants[variant],
          stateClass,
          icon && "pl-10",
          suffix && "pr-10",
          className,
        )}
        {...props}
      />
      {suffix && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          {suffix}
        </div>
      )}
    </div>
  );
});

/**
 * Textarea — Multi-line text input
 */
export const Textarea = forwardRef(function Textarea(
  { className, variant = "default", error, rows = 3, ...props },
  ref,
) {
  const stateClass = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
    : "";

  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error ? true : undefined}
      className={cn(
        "w-full px-4 py-3 text-base text-text placeholder:text-subtle/70 rounded-2xl",
        "outline-none transition-all duration-200 resize-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        stateClass,
        className,
      )}
      {...props}
    />
  );
});
