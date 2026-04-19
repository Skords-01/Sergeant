import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { Sheet } from "@shared/components/ui/Sheet";
import { normalizeUnit } from "../lib/pantryTextParser.js";

export function ItemEditSheet({ itemEdit, setItemEdit, onClose, onSave }) {
  return (
    <Sheet
      open={!!itemEdit.open}
      onClose={onClose}
      title={itemEdit.name}
      description="Кількість і одиниці (порожньо — прибрати)"
      zIndex={120}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-2xs font-bold text-subtle uppercase tracking-widest mb-1">
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
          <div className="text-2xs font-bold text-subtle uppercase tracking-widest mb-1">
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
            const qty = qtyStr === "" ? null : Number(qtyStr.replace(",", "."));
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
    </Sheet>
  );
}
