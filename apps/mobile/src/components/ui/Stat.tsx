/**
 * Sergeant Design System — Stat (React Native)
 *
 * Mobile port of the web `Stat` primitive.
 *
 * @see apps/web/src/shared/components/ui/Stat.tsx — canonical source of truth
 *
 * The canonical "eyebrow + big number + sublabel" triple that repeats
 * across dashboards. `variant` tints the value; `size` picks the number
 * typography.
 *
 * Differences from web (intentional):
 * - Renders as `<View>` with three `<Text>` rows instead of semantic
 *   div+heading markup. Header uses a SectionHeading (mobile port).
 * - Leading `icon` renders as a `<Text>` sibling next to the value; an
 *   emoji string or any ReactNode works.
 */

import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SectionHeading } from "./SectionHeading";

export type StatVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition";

export type StatSize = "sm" | "md" | "lg";

const variantClass: Record<StatVariant, string> = {
  default: "text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  finyk: "text-finyk",
  fizruk: "text-fizruk",
  routine: "text-routine",
  nutrition: "text-nutrition",
};

const valueSize: Record<StatSize, string> = {
  sm: "text-lg font-extrabold",
  md: "text-2xl font-extrabold",
  lg: "text-3xl font-black",
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  variant?: StatVariant;
  size?: StatSize;
  icon?: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

export function Stat({
  label,
  value,
  sublabel,
  variant = "default",
  size = "md",
  icon,
  align = "left",
  className,
}: StatProps) {
  const rowAlign =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";
  const textAlign =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  return (
    <View className={cx(className)}>
      <SectionHeading size="xs" className={textAlign}>
        {label}
      </SectionHeading>
      <View className={cx("mt-1 flex-row items-baseline", rowAlign)}>
        {icon != null &&
          (typeof icon === "string" || typeof icon === "number" ? (
            <Text className="text-base mr-1.5">{icon}</Text>
          ) : (
            <View className="mr-1.5">{icon}</View>
          ))}
        {typeof value === "string" || typeof value === "number" ? (
          <Text className={cx(valueSize[size], variantClass[variant])}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
      {sublabel != null &&
        (typeof sublabel === "string" || typeof sublabel === "number" ? (
          <Text className={cx("text-xs text-subtle mt-1", textAlign)}>
            {sublabel}
          </Text>
        ) : (
          <View className="mt-1">{sublabel}</View>
        ))}
    </View>
  );
}
