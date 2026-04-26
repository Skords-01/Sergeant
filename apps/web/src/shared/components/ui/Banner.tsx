import type { HTMLAttributes, ReactNode } from "react";
import type { StatusColor } from "@sergeant/design-tokens";
import { cn } from "@shared/lib/cn";

export type BannerVariant = StatusColor;

const variants: Record<BannerVariant, string> = {
  info: "border-line bg-panelHi/60 text-text",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-500/35 bg-amber-500/10 text-amber-200",
  danger: "border-danger/30 bg-danger/10 text-danger",
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
