import { Button } from "@shared/components/ui/Button";
import { Sheet } from "@shared/components/ui/Sheet";

export function ConfirmDeleteSheet({
  open,
  onClose,
  pantries,
  activePantryId: _activePantryId,
  onConfirm,
}) {
  if (!open) return null;

  const arr = Array.isArray(pantries) ? pantries : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Видалити склад?"
      description="Це прибере всі продукти в ньому. Дію не можна відмінити."
      zIndex={110}
      footer={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      }
    >
      {arr.length <= 1 ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          Не можна видалити останній склад.
        </div>
      ) : null}
    </Sheet>
  );
}
