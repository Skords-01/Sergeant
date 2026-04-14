import { useRef } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";

export function ConfirmDeleteSheet({
  open,
  onClose,
  pantries,
  activePantryId,
  onConfirm,
}) {
  const ref = useRef(null);
  useDialogFocusTrap(open, ref, { onEscape: onClose });

  if (!open) return null;

  const arr = Array.isArray(pantries) ? pantries : [];

  return (
    <div className={cn("fixed inset-0 flex items-end", "z-[110]")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Закрити"
        onClick={onClose}
      />
      <div
        ref={ref}
        className={cn(
          "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft",
          "fizruk-sheet-pad",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutrition-delete-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>
        <div className="px-5 pb-6">
          <div
            id="nutrition-delete-title"
            className="text-lg font-extrabold text-text leading-tight"
          >
            Видалити склад?
          </div>
          <div className="text-xs text-subtle mt-1">
            Це прибере всі продукти в ньому. Дію не можна відмінити.
          </div>
          {arr.length <= 1 ? (
            <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              Не можна видалити останній склад.
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-12 min-h-[44px]"
              onClick={onClose}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              variant="danger"
              className="h-12 min-h-[44px]"
              onClick={() => {
                if (arr.length <= 1) return;
                onConfirm();
              }}
            >
              Видалити
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
