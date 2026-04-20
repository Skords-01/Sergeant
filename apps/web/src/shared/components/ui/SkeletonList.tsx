import { cn } from "../../lib/cn";
import { Skeleton } from "./Skeleton";

export interface SkeletonListProps {
  /** Скільки рядків намалювати (за замовчуванням 5). */
  rows?: number;
  /** Висота кожного рядка. */
  rowClassName?: string;
  /** Відстань між рядками. */
  className?: string;
  /** Відрендерити "аватар"-квадрат ліворуч (корисно для списків транзакцій / вправ). */
  avatar?: boolean;
  /** Показати 2 лінії тексту (title + subtitle) замість однієї. */
  twoLine?: boolean;
}

/**
 * Уніфікований skeleton для списків (транзакції, тренування, звички,
 * прийоми їжі). Замінює спінер `animate-pulse` текст "Завантаження…",
 * що давав CLS і повне порожнє поле. Motion-safe: `animate-pulse` на
 * дочірніх `Skeleton` сам респектує `prefers-reduced-motion` через
 * Tailwind.
 */
export function SkeletonList({
  rows = 5,
  rowClassName,
  className,
  avatar = false,
  twoLine = false,
}: SkeletonListProps) {
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Завантаження списку"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 bg-panel border border-line rounded-2xl px-3 py-3",
            rowClassName,
          )}
        >
          {avatar && (
            <Skeleton className="w-10 h-10 rounded-xl shrink-0 motion-safe:animate-pulse" />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-2/3 motion-safe:animate-pulse" />
            {twoLine && (
              <Skeleton className="h-3 w-1/3 motion-safe:animate-pulse" />
            )}
          </div>
          <Skeleton className="h-3 w-12 shrink-0 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
