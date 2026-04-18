import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — ProgressRing Component
 *
 * Duolingo-inspired circular progress indicator with animation support,
 * completion celebrations, and glowing effects.
 *
 * Sizes: xs (32px), sm (48px), md (64px), lg (96px), xl (128px)
 * Variants: brand, finyk, fizruk, routine, nutrition
 */

export type ProgressRingSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ProgressRingVariant =
  | "brand"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition"
  | "success"
  | "warning"
  | "danger";

interface SizeConfig {
  size: number;
  strokeWidth: number;
  fontSize: string;
  glowSize: number;
}

interface VariantConfig {
  track: string;
  fill: string;
  text: string;
  glow: string;
  gradient: [string, string];
}

const sizes: Record<ProgressRingSize, SizeConfig> = {
  xs: { size: 32, strokeWidth: 3, fontSize: "text-2xs", glowSize: 4 },
  sm: { size: 48, strokeWidth: 4, fontSize: "text-xs", glowSize: 6 },
  md: { size: 64, strokeWidth: 5, fontSize: "text-sm", glowSize: 8 },
  lg: { size: 96, strokeWidth: 6, fontSize: "text-lg", glowSize: 12 },
  xl: { size: 128, strokeWidth: 8, fontSize: "text-xl", glowSize: 16 },
};

const variants: Record<ProgressRingVariant, VariantConfig> = {
  brand: {
    track: "stroke-brand-100 dark:stroke-brand-900/40",
    fill: "stroke-brand-500",
    text: "text-brand-600 dark:text-brand-400",
    glow: "rgba(16, 185, 129, 0.4)",
    gradient: ["#10b981", "#14b8a6"],
  },
  finyk: {
    track: "stroke-brand-100 dark:stroke-brand-900/40",
    fill: "stroke-finyk",
    text: "text-finyk",
    glow: "rgba(16, 185, 129, 0.4)",
    gradient: ["#10b981", "#0d9488"],
  },
  fizruk: {
    track: "stroke-teal-100 dark:stroke-teal-900/40",
    fill: "stroke-fizruk",
    text: "text-fizruk",
    glow: "rgba(20, 184, 166, 0.4)",
    gradient: ["#14b8a6", "#06b6d4"],
  },
  routine: {
    track: "stroke-coral-100 dark:stroke-coral-900/40",
    fill: "stroke-routine",
    text: "text-routine",
    glow: "rgba(249, 112, 102, 0.4)",
    gradient: ["#f97066", "#fb923c"],
  },
  nutrition: {
    track: "stroke-lime-100 dark:stroke-lime-900/40",
    fill: "stroke-nutrition",
    text: "text-nutrition",
    glow: "rgba(132, 204, 22, 0.4)",
    gradient: ["#84cc16", "#a3e635"],
  },
  // Status variants
  success: {
    track: "stroke-brand-100 dark:stroke-brand-900/40",
    fill: "stroke-success",
    text: "text-success",
    glow: "rgba(16, 185, 129, 0.4)",
    gradient: ["#10b981", "#34d399"],
  },
  warning: {
    track: "stroke-amber-100 dark:stroke-amber-900/40",
    fill: "stroke-warning",
    text: "text-warning",
    glow: "rgba(245, 158, 11, 0.4)",
    gradient: ["#f59e0b", "#fbbf24"],
  },
  danger: {
    track: "stroke-red-100 dark:stroke-red-900/40",
    fill: "stroke-danger",
    text: "text-danger",
    glow: "rgba(239, 68, 68, 0.4)",
    gradient: ["#ef4444", "#f87171"],
  },
};

export interface ProgressRingProps {
  value?: number;
  max?: number;
  size?: ProgressRingSize;
  variant?: ProgressRingVariant;
  showValue?: boolean;
  valueFormat?: (value: number, max: number) => ReactNode;
  label?: ReactNode;
  animate?: boolean;
  showGlow?: boolean;
  celebrateOnComplete?: boolean;
  className?: string;
  children?: ReactNode;
}

export function ProgressRing({
  value = 0,
  max = 100,
  size: sizeProp = "md",
  variant = "brand",
  showValue = true,
  valueFormat,
  label,
  animate = true,
  showGlow = true,
  celebrateOnComplete = false,
  className,
  children,
}: ProgressRingProps) {
  const config = sizes[sizeProp];
  const colors = variants[variant];
  const [celebrating, setCelebrating] = useState(false);

  const { size, strokeWidth, glowSize } = config;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const offset = circumference - (percentage / 100) * circumference;
  const isComplete = percentage >= 100;

  // Celebrate on completion
  useEffect(() => {
    if (celebrateOnComplete && isComplete) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [celebrateOnComplete, isComplete]);

  const displayValue = valueFormat
    ? valueFormat(value, max)
    : `${Math.round(percentage)}%`;

  // Generate unique gradient ID
  const gradientId = `progress-gradient-${variant}-${size}`;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        celebrating && "animate-celebration-pop",
        className,
      )}
    >
      {/* Glow effect behind the ring */}
      {showGlow && percentage > 0 && (
        <div
          className={cn(
            "absolute rounded-full transition-opacity duration-500",
            isComplete ? "opacity-60" : "opacity-30",
          )}
          style={{
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
            background: colors.glow,
            filter: `blur(${glowSize}px)`,
          }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="progress-ring relative"
        aria-hidden="true"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.gradient[0]} />
            <stop offset="100%" stopColor={colors.gradient[1]} />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn(colors.track)}
        />

        {/* Progress fill with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? offset : circumference}
          stroke={`url(#${gradientId})`}
          className={cn(
            "progress-ring-value",
            animate && "transition-[stroke-dashoffset] duration-700 ease-out",
            isComplete && "progress-ring-complete",
          )}
          style={
            {
              "--progress-offset": offset,
              filter: isComplete
                ? `drop-shadow(0 0 ${glowSize / 2}px ${colors.glow})`
                : "none",
            } as CSSProperties
          }
        />

        {/* Completion checkmark overlay */}
        {isComplete && celebrating && (
          <g className="animate-check-draw">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius * 0.4}
              fill={colors.gradient[0]}
              className="opacity-20"
            />
          </g>
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ? (
          children
        ) : (
          <>
            {showValue && (
              <span
                className={cn(
                  "font-bold tabular-nums transition-all duration-300",
                  config.fontSize,
                  colors.text,
                  isComplete && "scale-105",
                )}
              >
                {displayValue}
              </span>
            )}
            {label && (
              <span className="text-2xs text-muted mt-0.5">{label}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
