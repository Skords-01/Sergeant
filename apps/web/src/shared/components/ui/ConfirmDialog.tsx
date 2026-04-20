import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { cn } from "@shared/lib/cn";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * Reusable confirmation dialog (bottom sheet style).
 */
export function ConfirmDialog({
  open,
  title = "Підтвердити дію",
  description,
  confirmLabel = "Видалити",
  cancelLabel = "Скасувати",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(open, ref, { onEscape: onCancel });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleScrimKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCancel?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      {/* Scrim — real <button> keeps dismiss reachable by keyboard & AT. */}
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onCancel}
        onKeyDown={handleScrimKey}
        className="absolute inset-0 bg-text/40 backdrop-blur-sm motion-safe:animate-fade-in"
      />

      {/* Sheet */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full max-w-sm mx-4 mb-4 sm:mb-0 overscroll-contain",
          "bg-panel rounded-3xl shadow-float border border-line p-6",
          "animate-in slide-in-from-bottom-4 duration-200",
        )}
      >
        <h2
          id="confirm-title"
          className="text-[17px] font-bold text-text mb-2 leading-snug"
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted leading-relaxed mb-5">
            {description}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            variant={danger ? "destructive" : "primary"}
            className="w-full h-12"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" className="w-full h-12" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
