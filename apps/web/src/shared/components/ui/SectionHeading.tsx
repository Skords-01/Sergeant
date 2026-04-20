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
 *   - text-2xs text-nutrition/70 font-bold uppercase tracking-wide (nutrition macros)
 *
 * Sizes drive **font scale + weight + casing + tracking** only. Colour
 * is picked via `tone` so the same size can render in `subtle` (default
 * eyebrow on cards), `muted`, or a module-branded tint (finyk /
 * fizruk / routine / nutrition). Semantics default to <h3>.
 */

export type SectionHeadingSize = "xs" | "sm" | "md" | "lg" | "xl";

export type SectionHeadingTone =
  | "subtle"
  | "muted"
  | "text"
  | "accent"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition";

const sizes: Record<SectionHeadingSize, string> = {
  xs: "text-2xs font-bold uppercase tracking-widest",
  sm: "text-xs font-bold uppercase tracking-widest",
  md: "text-sm font-semibold",
  lg: "text-lg font-extrabold leading-tight",
  xl: "text-xl font-extrabold leading-tight",
};

const tones: Record<SectionHeadingTone, string> = {
  subtle: "text-subtle",
  muted: "text-muted",
  text: "text-text",
  // `accent` uses the global --c-accent (emerald by default). Resolves
  // per-module if a parent scopes the CSS variable.
  accent: "text-accent",
  // Module-branded tints — normalised to /70 so callers don't drift
  // between /70, /80, /90.
  finyk: "text-finyk/70",
  fizruk: "text-fizruk/70",
  routine: "text-routine/70",
  nutrition: "text-nutrition/70",
};

// Default tone per size — eyebrow sizes (xs/sm) are muted/subtle;
// body-size headings default to the foreground text colour.
const defaultToneForSize: Record<SectionHeadingSize, SectionHeadingTone> = {
  xs: "subtle",
  sm: "subtle",
  md: "text",
  lg: "text",
  xl: "text",
};

export interface SectionHeadingProps extends HTMLAttributes<HTMLElement> {
  size?: SectionHeadingSize;
  /** Colour variant. Defaults to `subtle` for xs/sm and `text` for md+. */
  tone?: SectionHeadingTone;
  as?: ElementType;
  /** Optional right-aligned slot for actions/links. */
  action?: ReactNode;
  children?: ReactNode;
  /** When `as="button"`, allow specifying the button type. */
  type?: "button" | "submit" | "reset";
  /** When `as="button"`, allow disabling. */
  disabled?: boolean;
}

export function SectionHeading({
  className,
  size = "xs",
  tone,
  as: Component = "h3",
  action,
  children,
  ...props
}: SectionHeadingProps) {
  const resolvedTone = tone ?? defaultToneForSize[size];
  const base = cn(sizes[size], tones[resolvedTone]);

  if (action) {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <Component className={base} {...props}>
          {children}
        </Component>
        <div className="shrink-0">{action}</div>
      </div>
    );
  }

  return (
    <Component className={cn(base, className)} {...props}>
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
export type SectionHeaderTone = SectionHeadingTone;
