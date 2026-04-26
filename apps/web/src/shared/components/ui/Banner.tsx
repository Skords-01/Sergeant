import type { HTMLAttributes, ReactNode } from "react";
import type { StatusColor } from "@sergeant/design-tokens";
import { cn } from "@shared/lib/cn";

export type BannerVariant = StatusColor;

// Light-mode pairs follow the soft Badge convention (`bg-{color}-50` +
// `text-{color}-800`) so contrast clears WCAG AA at 14 px (≥ 4.5:1).
// Dark-mode pairs preserve the original tinted-on-dark look but with
// readable foregrounds — the previous `text-emerald-100` / `text-amber-200`
// declarations were applied in *both* modes, which collapsed contrast to
// ~1.05:1 on the light-theme rendering.
const variants: Record<BannerVariant, string> = {
  info: "border-line bg-panelHi/60 text-text",
  success:
    "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100",
  danger:
    "border-red-200/70 bg-red-50 text-red-800 dark:border-danger/30 dark:bg-danger/10 dark:text-red-100",
};

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BannerVariant;
  children?: ReactNode;
}

export function Banner({
  variant = "info",
  className,
  children,
  ...props
}: BannerProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        variants[variant] || variants.info,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
