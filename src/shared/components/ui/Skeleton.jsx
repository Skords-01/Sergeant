import { cn } from "../../lib/cn";

export function Skeleton({ className }) {
  return (
    <div className={cn("animate-pulse bg-panelHi rounded-2xl", className)} />
  );
}

export function SkeletonText({ className }) {
  return (
    <div className={cn("animate-pulse bg-panelHi rounded-lg h-3", className)} />
  );
}
