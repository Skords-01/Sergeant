import {
  forwardRef,
  type HTMLInputTypeAttribute,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

/**
 * Opinionated per-`type` defaults for `spellCheck`, `inputMode`, and
 * `autoComplete`. Per the Web Interface Guidelines, non-prose inputs
 * (email / url / password / numeric / code fields) should disable
 * spellcheck so the browser does not red-underline legitimate values
 * and should hint the right software keyboard / autofill category on
 * mobile. Consumers can always override by passing the prop explicitly
 * — the Input only fills in a default when the caller did not.
 */
const NON_PROSE_TYPES = new Set<HTMLInputTypeAttribute>([
  "email",
  "password",
  "url",
  "tel",
  "number",
  "search",
]);

const DEFAULT_INPUT_MODE: Partial<
  Record<
    HTMLInputTypeAttribute,
    InputHTMLAttributes<HTMLInputElement>["inputMode"]
  >
> = {
  email: "email",
  tel: "tel",
  url: "url",
  number: "decimal",
  search: "search",
};

/**
 * Sergeant Design System — Input Component
 *
 * Sizes: sm, md, lg
 * Variants: default, filled, ghost
 * States: error, success
 */

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "filled" | "ghost";

const sizes: Record<InputSize, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-base rounded-2xl",
  lg: "h-12 px-5 text-base rounded-2xl",
};

/**
 * Focus treatment — mirrors `Button`'s `focus-visible:ring-2 ring-brand-500/45`
 * contract so all interactive elements share one a11y language. Keyboard
 * users always see a ring; pointer clicks on text inputs don't flash it.
 * Fallback `focus:` rules keep legacy browsers without :focus-visible on
 * par with click-visible behaviour.
 */
const variants: Record<InputVariant, string> = {
  default:
    "bg-panelHi border border-line focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus:border-brand-400",
  filled:
    "bg-panelHi border-transparent focus-visible:bg-panel focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus:bg-panel focus:border-brand-400",
  ghost:
    "bg-transparent border-transparent hover:bg-panelHi focus-visible:bg-panelHi focus-visible:ring-2 focus-visible:ring-brand-500/30 focus:bg-panelHi",
};

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  size?: InputSize;
  variant?: InputVariant;
  error?: boolean;
  success?: boolean;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    size = "md",
    variant = "default",
    error,
    success,
    icon,
    suffix,
    type,
    spellCheck,
    inputMode,
    ...props
  },
  ref,
) {
  const stateClass = error
    ? "border-danger/70 focus-visible:border-danger focus-visible:ring-danger/25 focus:border-danger"
    : success
      ? "border-brand-400 focus-visible:border-brand-500 focus-visible:ring-brand-500/25 focus:border-brand-500"
      : "";

  // Type-aware defaults. The caller's explicit prop always wins — these
  // only fill in when `undefined` so existing call sites don't change.
  const resolvedSpellCheck =
    spellCheck ?? (type && NON_PROSE_TYPES.has(type) ? false : undefined);
  const resolvedInputMode =
    inputMode ?? (type ? DEFAULT_INPUT_MODE[type] : undefined);

  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        type={type}
        spellCheck={resolvedSpellCheck}
        inputMode={resolvedInputMode}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full text-text placeholder:text-subtle/70",
          "outline-none transition-colors duration-200",
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

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: InputVariant;
  error?: boolean;
}

/**
 * Textarea — Multi-line text input
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { className, variant = "default", error, rows = 3, ...props },
    ref,
  ) {
    const stateClass = error
      ? "border-danger/70 focus-visible:border-danger focus-visible:ring-danger/25 focus:border-danger"
      : "";

    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full px-4 py-3 text-base text-text placeholder:text-subtle/70 rounded-2xl",
          "outline-none transition-colors duration-200 resize-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          stateClass,
          className,
        )}
        {...props}
      />
    );
  },
);
