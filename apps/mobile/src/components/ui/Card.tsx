/**
 * Sergeant Design System — Card (React Native)
 *
 * Mobile port of the web Card primitive. Public API mirrors the web
 * component so screens can share prop shapes across platforms.
 *
 * @see apps/web/src/shared/components/ui/Card.tsx — canonical source of truth
 *
 * Parity notes:
 * - Same `CardVariant` enum: `default` / `interactive` / `flat` /
 *   `elevated` / `ghost` plus module-branded `finyk` / `fizruk` /
 *   `routine` / `nutrition` and their `-soft` counterparts.
 * - Same `padding` sizes (none / sm / md / lg / xl) and `radius`
 *   (md / lg / xl) hierarchy. Module-branded variants still bake
 *   `rounded-3xl` into their class string just like on web.
 * - `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` /
 *   `CardFooter` sub-components are all ported so composition stays
 *   identical to web.
 *
 * Differences from web (intentional — see PR body):
 * - No `as` prop: RN has no HTML element polymorphism. Container is
 *   always a `View`, sub-text is always `Text`.
 * - Hover / transition / `active:scale` utilities on `interactive` are
 *   dropped — RN has no hover state and press feedback is applied via
 *   `Pressable`'s `pressed` callback. Callers that need press feedback
 *   should wrap the Card in their own `Pressable` (or swap to `Button`).
 * - Dark-mode `dark:` modifiers on branded variants are dropped for
 *   now — mobile's semantic dark-mode tokens are not wired up yet
 *   (same caveat as Button.tsx). Branded surfaces render the light
 *   variant only until mobile CSS variables land.
 * - `CardFooter` uses `borderTopWidth: 1` via a NativeWind class; the
 *   web uses `border-t border-line`. Same visual outcome, mobile-safe
 *   class set.
 */

import { forwardRef, type ReactNode } from "react";
import {
  Text,
  type TextProps,
  View,
  type ViewProps,
  type View as RNView,
} from "react-native";

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
// Module-branded variants bake `rounded-3xl` into their class string for
// hero surfaces, matching the web component.
// TODO: align with design-tokens — `bg-panel` / `border-line` / `shadow-*`
// resolve through CSS variables that are not yet wired up on mobile.
// Same `cream-*` fallback approach as Button.tsx until the semantic
// colour variables land on the mobile runtime.
const variantContainer: Record<CardVariant, string> = {
  default: "bg-cream-50 border border-cream-300",
  interactive: "bg-cream-50 border border-cream-300",
  flat: "bg-cream-50 border border-cream-300",
  elevated: "bg-cream-50 border border-cream-300",
  ghost: "bg-transparent border border-transparent",

  // Module hero cards — branded surface. Mobile strips the `dark:` modifiers
  // (no dark-mode plumbing yet) but keeps the branded border + solid token.
  finyk: "rounded-3xl border border-brand-200/50 bg-finyk",
  fizruk: "rounded-3xl border border-teal-200/50 bg-fizruk",
  routine: "rounded-3xl border border-coral-200/50 bg-routine",
  nutrition: "rounded-3xl border border-lime-200/50 bg-nutrition",

  // Soft module cards — less prominent tinted surface.
  "finyk-soft": "rounded-2xl border border-brand-100 bg-brand-50/50",
  "fizruk-soft": "rounded-2xl border border-teal-100 bg-teal-50/50",
  "routine-soft": "rounded-2xl border border-coral-100 bg-coral-50/50",
  "nutrition-soft": "rounded-2xl border border-lime-100 bg-lime-50/50",
};

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
  xl: "p-6",
};

const CORE_VARIANTS: ReadonlySet<CardVariant> = new Set<CardVariant>([
  "default",
  "interactive",
  "flat",
  "elevated",
  "ghost",
]);

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export interface CardProps extends Omit<ViewProps, "style"> {
  variant?: CardVariant;
  padding?: CardPadding;
  radius?: CardRadius;
  className?: string;
  children?: ReactNode;
}

export const Card = forwardRef<RNView, CardProps>(function Card(
  {
    variant = "default",
    padding = "md",
    radius = "xl",
    className,
    children,
    ...props
  },
  ref,
) {
  // Module (branded) variants bake their own radius — match web behaviour.
  const radiusClass = CORE_VARIANTS.has(variant) ? radii[radius] : "";

  return (
    <View
      ref={ref}
      className={cx(
        variantContainer[variant],
        radiusClass,
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
});

export interface CardHeaderProps extends Omit<ViewProps, "style"> {
  className?: string;
  children?: ReactNode;
}

/**
 * CardHeader — Consistent header row for cards (title on the left,
 * optional action slot on the right).
 */
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <View
      className={cx("flex-row items-center justify-between mb-4", className)}
      {...props}
    >
      {children}
    </View>
  );
}

export interface CardTitleProps extends Omit<TextProps, "style"> {
  className?: string;
  children?: ReactNode;
}

/**
 * CardTitle — Title text for cards. Mirrors the web `text-lg font-semibold`
 * treatment; colour falls back to `stone-900` until mobile `text-text`
 * token lands (see TODO above).
 */
export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <Text
      className={cx("text-lg font-semibold text-stone-900", className)}
      {...props}
    >
      {children}
    </Text>
  );
}

export interface CardDescriptionProps extends Omit<TextProps, "style"> {
  className?: string;
  children?: ReactNode;
}

/**
 * CardDescription — Secondary text under the title.
 */
export function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <Text className={cx("text-sm text-stone-500 mt-1", className)} {...props}>
      {children}
    </Text>
  );
}

export interface CardContentProps extends Omit<ViewProps, "style"> {
  className?: string;
  children?: ReactNode;
}

/**
 * CardContent — Main content area.
 */
export function CardContent({
  className,
  children,
  ...props
}: CardContentProps) {
  return (
    <View className={cx(className)} {...props}>
      {children}
    </View>
  );
}

export interface CardFooterProps extends Omit<ViewProps, "style"> {
  className?: string;
  children?: ReactNode;
}

/**
 * CardFooter — Footer row for actions. Web uses `border-t border-line`;
 * mobile uses a concrete `cream-300` divider until the semantic token
 * is wired up (see TODO in `variantContainer`).
 */
export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <View
      className={cx(
        "flex-row items-center gap-3 mt-4 pt-4 border-t border-cream-300",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}
