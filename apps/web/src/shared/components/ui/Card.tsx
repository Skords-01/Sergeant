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
 * - elevated: Soft float shadow for hero/preview surfaces
 * - ghost: Transparent (use only when nesting in a coloured wrapper)
 *
 * Plus module-branded variants (finyk, fizruk, routine, nutrition) and
 * their soft counterparts (`*-soft`).
 *
 * Padding: none | sm | md (default) | lg | xl.
 *
 * Radius hierarchy (canonical):
 *   - md  → rounded-xl  (16px) — inline / list cards & chips
 *   - lg  → rounded-2xl (24px) — section/panel cards (DEFAULT for content
 *                                blocks inside a page)
 *   - xl  → rounded-3xl (32px) — hero & module-branded cards (the four
 *                                module variants bake this in already)
 *
 * The default `radius="xl"` matches the largest hero treatment so that
 * branded cards and `<Card variant="default" radius="xl">` wrappers feel
 * consistent. Use `radius="lg"` for the typical settings/list panel.
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

export type CardRadius = "md" | "lg" | "xl";

const radii: Record<CardRadius, string> = {
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};

// Core variants omit the radius class — it's controlled by the `radius` prop.
// Module (branded) variants bake rounded-3xl into their class string for hero surfaces.
const variants: Record<CardVariant, string> = {
  default: "bg-panel border border-line shadow-card",
  interactive:
    "bg-panel border border-line shadow-card transition-interactive hover:shadow-float hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer",
  flat: "bg-panel border border-line",
  elevated: "bg-panel border border-line shadow-float",
  ghost: "bg-transparent border border-transparent",

  // Module hero cards — branded surface in light, subtle tinted panel in dark.
  finyk:
    "rounded-3xl border border-brand-200/50 bg-hero-emerald shadow-card dark:border-brand-800/30 dark:bg-panel dark:bg-card-finyk-dark",
  fizruk:
    "rounded-3xl border border-teal-200/50 bg-hero-teal shadow-card dark:border-teal-800/30 dark:bg-panel dark:bg-card-fizruk-dark",
  routine:
    "rounded-3xl border border-coral-200/50 bg-hero-coral shadow-card dark:border-[rgba(162,51,51,0.3)] dark:bg-panel dark:bg-card-routine-dark",
  nutrition:
    "rounded-3xl border border-lime-200/50 bg-hero-lime shadow-card dark:border-[rgba(70,98,18,0.3)] dark:bg-panel dark:bg-card-nutrition-dark",

  // Soft module cards (less prominent)
  "finyk-soft":
    "rounded-2xl border border-brand-100 bg-brand-50/50 backdrop-blur-sm dark:border-brand-500/20 dark:bg-brand-500/10",
  "fizruk-soft":
    "rounded-2xl border border-teal-100 bg-teal-50/50 backdrop-blur-sm dark:border-teal-500/20 dark:bg-teal-500/10",
  "routine-soft":
    "rounded-2xl border border-coral-100 bg-coral-50/50 backdrop-blur-sm dark:border-coral-500/20 dark:bg-coral-500/10",
  "nutrition-soft":
    "rounded-2xl border border-lime-100 bg-lime-50/50 backdrop-blur-sm dark:border-lime-500/20 dark:bg-lime-500/10",
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
  radius?: CardRadius;
  as?: ElementType;
  children?: ReactNode;
}

const CORE_VARIANTS: ReadonlySet<CardVariant> = new Set([
  "default",
  "interactive",
  "flat",
  "elevated",
  "ghost",
]);

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    className,
    variant = "default",
    padding = "md",
    radius = "xl",
    as: Component = "div",
    children,
    ...props
  },
  ref,
) {
  // Module (branded) variants bake their own radius for hero treatment.
  const radiusClass = CORE_VARIANTS.has(variant) ? radii[radius] : "";
  return (
    <Component
      ref={ref}
      className={cn(
        variants[variant],
        radiusClass,
        paddings[padding],
        className,
      )}
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
