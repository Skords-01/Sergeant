import {
  memo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type TouchEvent,
} from "react";
import { cn } from "@shared/lib/cn";

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 100;

export interface SwipeToActionProps {
  children?: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: ReactNode;
  rightLabel?: ReactNode;
  leftColor?: string;
  rightColor?: string;
  disabled?: boolean;
}

function SwipeToActionImpl({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = "✓",
  rightLabel = "🗑",
  leftColor = "bg-success",
  rightColor = "bg-danger",
  disabled = false,
}: SwipeToActionProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [committed, setCommitted] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);

  const reset = useCallback(() => {
    setOffset(0);
    setIsDragging(false);
    isHorizontal.current = null;
    startX.current = null;
    startY.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      setCommitted(false);
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      isHorizontal.current = null;
      setIsDragging(true);
    },
    [disabled],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!isDragging || startX.current === null || startY.current === null)
        return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (isHorizontal.current === null) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }

      if (!isHorizontal.current) {
        setIsDragging(false);
        return;
      }

      e.preventDefault();
      const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
      if (clamped < 0 && !onSwipeLeft) return;
      if (clamped > 0 && !onSwipeRight) return;
      setOffset(clamped);
    },
    [isDragging, onSwipeLeft, onSwipeRight],
  );

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    if (offset < -SWIPE_THRESHOLD && onSwipeLeft) {
      setCommitted(true);
      setTimeout(() => {
        onSwipeLeft();
        reset();
        setCommitted(false);
      }, 200);
    } else if (offset > SWIPE_THRESHOLD && onSwipeRight) {
      setCommitted(true);
      setTimeout(() => {
        onSwipeRight();
        reset();
        setCommitted(false);
      }, 200);
    } else {
      reset();
    }
    setIsDragging(false);
  }, [isDragging, offset, onSwipeLeft, onSwipeRight, reset]);

  const showLeft = offset < 0 && onSwipeLeft;
  const showRight = offset > 0 && onSwipeRight;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {showLeft && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-center px-5 text-white font-semibold text-sm",
            rightColor,
          )}
          style={{ width: Math.abs(offset) }}
          aria-hidden
        >
          <span
            className={cn(
              "transition-opacity",
              Math.abs(offset) > SWIPE_THRESHOLD ? "opacity-100" : "opacity-60",
            )}
          >
            {rightLabel}
          </span>
        </div>
      )}
      {showRight && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-center px-5 text-white font-semibold text-sm",
            leftColor,
          )}
          style={{ width: Math.abs(offset) }}
          aria-hidden
        >
          <span
            className={cn(
              "transition-opacity",
              Math.abs(offset) > SWIPE_THRESHOLD ? "opacity-100" : "opacity-60",
            )}
          >
            {leftLabel}
          </span>
        </div>
      )}
      <div
        style={{
          transform: `translateX(${committed ? (offset < 0 ? -MAX_SWIPE * 2 : MAX_SWIPE * 2) : offset}px)`,
          transition:
            isDragging && !committed ? "none" : "transform 0.2s ease-out",
          willChange: "transform",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export const SwipeToAction = memo(SwipeToActionImpl);
