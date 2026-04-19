import { type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — SectionHeading
 *
 * Consolidates the 80+ "eyebrow"-style section titles scattered across
 * modules. Current de-facto drift:
 *   - text-2xs font-bold text-subtle uppercase tracking-widest  (53 matches)
 *   - text-xs  font-bold text-subtle uppercase tracking-widest  (majority of Fizruk)
 *   - text-xs  text-muted uppercase tracking-wide font-semibold (Finyk)
 *
 * The canonical sizes are xs (for in-card titles) and xl (for section
 * headers above a group of cards). Semantics default to <h3> — callers
 * can override via `as`.
 */

export type SectionHeadingSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<SectionHeadingSize, string> = {
  xs: "text-2xs font-bold text-subtle uppercase tracking-widest",
  sm: "text-xs font-bold text-subtle uppercase tracking-widest",
  md: "text-sm font-semibold text-text",
  lg: "text-lg font-extrabold text-text leading-tight",
  xl: "text-xl font-extrabold text-text leading-tight",
};

export interface SectionHeadingProps extends HTMLAttributes<HTMLElement> {
  size?: SectionHeadingSize;
  as?: ElementType;
  /** Optional right-aligned slot for actions/links. */
  action?: ReactNode;
  children?: ReactNode;
}

export function SectionHeading({
  className,
  size = "xs",
  as: Component = "h3",
  action,
  children,
  ...props
}: SectionHeadingProps) {
  if (action) {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <Component className={sizes[size]} {...props}>
          {children}
        </Component>
        <div className="shrink-0">{action}</div>
      </div>
    );
  }

  return (
    <Component className={cn(sizes[size], className)} {...props}>
      {children}
    </Component>
  );
}

/**
 * Alias exported so that consumers can import `SectionHeader` alongside
 * `Card` / `Badge` / `Tabs` / etc. Both names resolve to the same
 * component — prefer `SectionHeader` in new code.
 */
export const SectionHeader = SectionHeading;
export type SectionHeaderProps = SectionHeadingProps;
export type SectionHeaderSize = SectionHeadingSize;
