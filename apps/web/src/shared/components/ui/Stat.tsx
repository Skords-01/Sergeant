import { type ReactNode } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Stat
 *
 * The canonical "eyebrow + big number + sublabel" triple that repeats
 * dozens of times across Fizruk dashboards and Finyk summaries:
 *
 *   <SectionHeading as="div" size="xs">Вага</SectionHeading>
 *   <div className="text-2xl font-extrabold text-text mt-1 tabular-nums">82 кг</div>
 *   <div className="text-xs text-subtle mt-1">+0.4 кг</div>
 *
 * `variant` tints the value (see `docs/COMPONENT_API.md`): default
 * (text-text), success, warning, danger, and each module's brand token
 * (finyk/fizruk/routine/nutrition) for the rare branded metric readouts.
 */

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
  sm: "text-lg font-extrabold tabular-nums",
  md: "text-2xl font-extrabold tabular-nums",
  lg: "text-3xl font-black tabular-nums",
};

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  /** Colour variant for the value. Defaults to `default` (text-text). */
  variant?: StatVariant;
  size?: StatSize;
  /** Optional leading icon / emoji rendered left of the value. */
  icon?: ReactNode;
  /** Align contents. Defaults to left. */
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
  const alignClass =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  return (
    <div className={cn(alignClass, className)}>
      <SectionHeading as="div" size="xs">
        {label}
      </SectionHeading>
      <div
        className={cn(
          "mt-1 flex items-baseline gap-1.5",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
          valueSize[size],
          variantClass[variant],
        )}
      >
        {icon && (
          <span className="text-base font-normal leading-none">{icon}</span>
        )}
        <span>{value}</span>
      </div>
      {sublabel && <div className="text-xs text-subtle mt-1">{sublabel}</div>}
    </div>
  );
}
