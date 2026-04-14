import { useRef } from "react";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { cn } from "@shared/lib/cn";
import { Button } from "./Button";

/**
 * Reusable confirmation dialog (bottom sheet style).
 *
 * Props:
 *   open         — boolean, whether the dialog is visible
 *   title        — string, dialog heading
 *   description  — string | ReactNode, body text
 *   confirmLabel — string, confirm button text (default "Видалити")
 *   cancelLabel  — string, cancel button text (default "Скасувати")
 *   danger       — boolean, use danger variant for confirm button (default true)
 *   onConfirm    — () => void
 *   onCancel     — () => void
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
}) {
  const ref = useRef(null);
  useDialogFocusTrap(open, ref, { onEscape: onCancel });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className={cn(
          "relative z-10 w-full max-w-sm mx-4 mb-4 sm:mb-0",
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
            variant={danger ? "danger" : "primary"}
            className={cn(
              "w-full h-12",
              danger && "!bg-danger !text-white border-0",
            )}
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
