import { useRef } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";

export function PantryManagerSheet({
  open,
  onClose,
  pantries,
  activePantryId,
  setActivePantryId,
  pantryForm,
  setPantryForm,
  busy,
  onSavePantryForm,
  onBeginCreate,
  onBeginRename,
  onBeginDelete,
}) {
  const ref = useRef(null);
  useDialogFocusTrap(open, ref, { onEscape: onClose });

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 flex items-end", "z-[100]")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Закрити"
        onClick={onClose}
      />
      <div
        ref={ref}
        className={cn(
          "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[92dvh] flex flex-col",
          "fizruk-sheet-pad",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutrition-pantries-title"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>
        <div className="px-4 sm:px-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div
                id="nutrition-pantries-title"
                className="text-lg font-extrabold text-text leading-tight"
              >
                Склади продуктів
              </div>
              <div className="text-xs text-subtle mt-1">
                Створи окремо для Дім / Робота або по дієті
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

          <div className="rounded-2xl border border-line bg-bg overflow-hidden mb-4">
            {(Array.isArray(pantries) ? pantries : []).map((p) => {
              const active = p.id === activePantryId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePantryId(p.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                    active && "bg-nutrition/10",
                  )}
                  aria-pressed={active}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text truncate">
                      {p.name || "Склад"}
                    </div>
                    {active ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-nutrition/15 text-nutrition border border-nutrition/25">
                        Активний
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            <Button
              type="button"
              className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
              onClick={onBeginCreate}
            >
              + Новий склад
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 min-h-[44px]"
              onClick={onBeginRename}
            >
              Перейменувати активний
            </Button>
          </div>

          <div className="rounded-2xl border border-line bg-panelHi p-4">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
              {pantryForm.mode === "rename" ? "Нова назва" : "Назва складу"}
            </div>
            <div className="mt-2">
              <Input
                value={pantryForm.name}
                onChange={(e) =>
                  setPantryForm((f) => ({ ...f, name: e.target.value, err: "" }))
                }
                placeholder="напр. Дім"
                disabled={busy}
                aria-label="Назва складу"
              />
              {pantryForm.err ? (
                <div className="text-xs text-danger mt-2">{pantryForm.err}</div>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
                onClick={() => {
                  const name = String(pantryForm.name || "").trim();
                  if (!name) {
                    setPantryForm((f) => ({ ...f, err: "Вкажи назву." }));
                    return;
                  }
                  onSavePantryForm(name, pantryForm.mode);
                }}
              >
                Зберегти
              </Button>
              <Button
                type="button"
                variant="danger"
                className="h-12 min-h-[44px]"
                onClick={onBeginDelete}
              >
                Видалити активний
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
