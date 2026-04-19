import { forwardRef } from "react";
import type { ElementType, HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Card Component
 */

const variants = {
  default: "bg-panel border border-line rounded-3xl shadow-card",
  interactive:
    "bg-panel border border-line rounded-3xl shadow-card transition-all duration-200 ease-smooth hover:shadow-float hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer",
  flat: "bg-panel border border-line rounded-3xl",
  elevated: "bg-panel border border-line rounded-3xl shadow-float",
  ghost: "bg-transparent border border-transparent rounded-3xl",

  finyk: "rounded-3xl border border-brand-200/50 bg-hero-emerald shadow-card",
  fizruk: "rounded-3xl border border-teal-200/50 bg-hero-teal shadow-card",
  routine: "rounded-3xl border border-coral-200/50 bg-hero-coral shadow-card",
  nutrition: "rounded-3xl border border-lime-200/50 bg-hero-lime shadow-card",

  "finyk-soft":
    "rounded-2xl border border-brand-100 bg-brand-50/50 backdrop-blur-sm",
  "fizruk-soft":
    "rounded-2xl border border-teal-100 bg-teal-50/50 backdrop-blur-sm",
  "routine-soft":
    "rounded-2xl border border-coral-100 bg-coral-50/50 backdrop-blur-sm",
  "nutrition-soft":
    "rounded-2xl border border-lime-100 bg-lime-50/50 backdrop-blur-sm",
} as const;

export type CardVariant = keyof typeof variants;

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
  xl: "p-6",
} as const;

export type CardPadding = keyof typeof paddings;

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
      ref={ref as Ref<HTMLElement>}
      className={cn(variants[variant], paddings[padding], className)}
      {...props}
    >
      {children}
    </Component>
  );
});

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

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted mt-1", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

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
