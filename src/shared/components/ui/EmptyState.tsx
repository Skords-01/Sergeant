import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-14 px-6 gap-3",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-panelHi border border-line text-subtle",
            compact ? "w-10 h-10" : "w-14 h-14",
          )}
        >
          {icon}
        </div>
      )}
      <p
        className={cn(
          "font-semibold text-text",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "text-muted leading-relaxed max-w-xs",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
