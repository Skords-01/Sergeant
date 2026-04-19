import { cn } from "../../lib/cn";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse bg-panelHi rounded-2xl", className)} />
  );
}

export function SkeletonText({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse bg-panelHi rounded-lg h-3", className)} />
  );
}
