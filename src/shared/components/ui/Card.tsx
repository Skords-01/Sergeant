import {
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Card Component
 *
 * Variants:
 * - default: Standard panel card
 * - interactive: Hover lift effect for clickable cards
 * - flat: No shadow, minimal border
 *
 * Plus module-branded variants (finyk, fizruk, routine, nutrition) and
 * their soft counterparts.
 *
 * Padding: none | sm | md (default) | lg | xl.
 */

export type CardVariant =
  | "default"
  | "interactive"
  | "flat"
  | "elevated"
  | "ghost"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition"
  | "finyk-soft"
  | "fizruk-soft"
  | "routine-soft"
  | "nutrition-soft";

export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

const variants: Record<CardVariant, string> = {
  default: "bg-panel border border-line rounded-3xl shadow-card",
  interactive:
    "bg-panel border border-line rounded-3xl shadow-card transition-all duration-200 ease-smooth hover:shadow-float hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer",
  flat: "bg-panel border border-line rounded-3xl",
  elevated: "bg-panel border border-line rounded-3xl shadow-float",
  ghost: "bg-transparent border border-transparent rounded-3xl",

  // Module hero cards — branded surface in light, subtle tinted panel in dark.
  finyk:
    "rounded-3xl border border-brand-200/50 bg-hero-emerald shadow-card dark:border-brand-800/30 dark:bg-panel dark:[background-image:linear-gradient(135deg,rgba(16,185,129,0.1)_0%,transparent_100%)]",
  fizruk:
    "rounded-3xl border border-teal-200/50 bg-hero-teal shadow-card dark:border-teal-800/30 dark:bg-panel dark:[background-image:linear-gradient(135deg,rgba(20,184,166,0.1)_0%,transparent_100%)]",
  routine:
    "rounded-3xl border border-coral-200/50 bg-hero-coral shadow-card dark:border-[rgba(162,51,51,0.3)] dark:bg-panel dark:[background-image:linear-gradient(135deg,rgba(249,112,102,0.1)_0%,transparent_100%)]",
  nutrition:
    "rounded-3xl border border-lime-200/50 bg-hero-lime shadow-card dark:border-[rgba(70,98,18,0.3)] dark:bg-panel dark:[background-image:linear-gradient(135deg,rgba(146,204,23,0.1)_0%,transparent_100%)]",

  // Soft module cards (less prominent)
  "finyk-soft":
    "rounded-2xl border border-brand-100 bg-brand-50/50 backdrop-blur-sm",
  "fizruk-soft":
    "rounded-2xl border border-teal-100 bg-teal-50/50 backdrop-blur-sm",
  "routine-soft":
    "rounded-2xl border border-coral-100 bg-coral-50/50 backdrop-blur-sm",
  "nutrition-soft":
    "rounded-2xl border border-lime-100 bg-lime-50/50 backdrop-blur-sm",
};

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
  xl: "p-6",
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  as?: ElementType;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    className,
    variant = "default",
    padding = "md",
    as: Component = "div",
    children,
    ...props
  },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={cn(variants[variant], paddings[padding], className)}
      {...props}
    >
      {children}
    </Component>
  );
});

/**
 * CardHeader — Consistent header section for cards
 */
export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

/**
 * CardTitle — Title text for cards
 */
export function CardTitle({
  className,
  as: Component = "h3",
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={cn("text-lg font-semibold text-text", className)}
      {...props}
    />
  );
}

/**
 * CardDescription — Secondary text for cards
 */
export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted mt-1", className)} {...props} />;
}

/**
 * CardContent — Main content area with optional overflow handling
 */
export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

/**
 * CardFooter — Footer section for actions
 */
export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 mt-4 pt-4 border-t border-line",
        className,
      )}
      {...props}
    />
  );
}
