import { cn } from "../../lib/cn";

export interface SkeletonProps {
  className?: string;
}

// `motion-safe:animate-pulse` замість безумовного `animate-pulse`:
// користувачі з `prefers-reduced-motion: reduce` отримають статичну
// панель замість миготіння (вимога WCAG 2.3.3 + Apple HIG reduced motion).
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "motion-safe:animate-pulse bg-panelHi rounded-2xl",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "motion-safe:animate-pulse bg-panelHi rounded-lg h-3",
        className,
      )}
      aria-hidden="true"
    />
  );
}
