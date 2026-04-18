import { useRef } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { normalizeUnit } from "../lib/pantryTextParser.js";

export function ItemEditSheet({ itemEdit, setItemEdit, onClose, onSave }) {
  const ref = useRef(null);
  useDialogFocusTrap(itemEdit.open, ref, { onEscape: onClose });

  if (!itemEdit.open) return null;

  return (
    <div className={cn("fixed inset-0 flex items-end", "z-[120]")}>
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
        aria-labelledby="nutrition-item-edit-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>
        <div className="px-5 pb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div
                id="nutrition-item-edit-title"
                className="text-lg font-extrabold text-text leading-tight truncate"
              >
                {itemEdit.name}
              </div>
              <div className="text-xs text-subtle mt-1">
                Кількість і одиниці (порожньо — прибрати)
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-1">
                Кількість
              </div>
              <Input
                value={itemEdit.qty}
                onChange={(e) =>
                  setItemEdit((s) => ({ ...s, qty: e.target.value, err: "" }))
                }
                inputMode="decimal"
                placeholder="напр. 2.5"
                aria-label="Кількість"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-1">
                Одиниця
              </div>
              <Input
                value={itemEdit.unit}
                onChange={(e) =>
                  setItemEdit((s) => ({ ...s, unit: e.target.value, err: "" }))
                }
                placeholder="г / кг / мл / л / шт"
                aria-label="Одиниця"
              />
            </div>
          </div>

          {itemEdit.err ? (
            <div className="text-xs text-danger mt-2">{itemEdit.err}</div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
              onClick={() => {
                const qtyStr = String(itemEdit.qty || "").trim();
                const unitStr = String(itemEdit.unit || "").trim();
                const qty =
                  qtyStr === "" ? null : Number(qtyStr.replace(",", "."));
                if (qtyStr !== "" && !Number.isFinite(qty)) {
                  setItemEdit((s) => ({ ...s, err: "Некоректна кількість." }));
                  return;
                }
                const unit = unitStr === "" ? null : normalizeUnit(unitStr);
                onSave(itemEdit.idx, Number.isFinite(qty) ? qty : null, unit);
              }}
            >
              Зберегти
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 min-h-[44px]"
              onClick={onClose}
            >
              Скасувати
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
