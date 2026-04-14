import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";

export function PantryCard({
  busy,
  activePantry,
  parsePantry,
  applyTemplate,
  newItemName,
  setNewItemName,
  upsertItem,
  pantryText,
  setPantryText,
  effectiveItems,
  editItemAt,
  removeItemAtOrByName,
  pantryItemsLength,
  pantrySummary,
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">
            Продукти ({activePantry?.name || "Склад"})
          </div>
          <div className="text-xs text-subtle mt-0.5">
            Додавай нові покупки — воно мерджиться, не стирає попереднє.
          </div>
        </div>
        <button
          type="button"
          onClick={parsePantry}
          disabled={busy}
          className={cn(
            "shrink-0 px-4 h-10 rounded-xl text-sm font-medium",
            "bg-panel border border-line text-text hover:border-muted disabled:opacity-50",
          )}
        >
          Розібрати
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { id: "quickBreakfast", label: "Швидкий сніданок" },
            { id: "quickLunch", label: "Швидкий обід" },
            { id: "quickFitness", label: "Фітнес" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              disabled={busy}
              className="text-xs px-3 py-1.5 bg-panel border border-line rounded-full text-subtle hover:text-text hover:border-muted whitespace-nowrap transition-colors shrink-0 disabled:opacity-40"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Додати продукт… (напр. лосось)"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => {
              upsertItem(newItemName);
              setNewItemName("");
            }}
            disabled={busy || !newItemName.trim()}
            className={cn(
              "px-4 h-11 rounded-2xl text-sm font-semibold shrink-0",
              "bg-nutrition text-white hover:bg-nutrition-hover disabled:opacity-50",
            )}
          >
            Додати
          </button>
        </div>

        <div className="flex gap-2 items-start">
          <textarea
            value={pantryText}
            onChange={(e) => setPantryText(e.target.value)}
            placeholder={'Напр.: "2 яйця, курка, рис, огірки, сир, йогурт"'}
            className="flex-1 min-h-[96px] rounded-2xl bg-panel border border-line px-4 py-3 text-sm text-text outline-none focus:border-nutrition/60 placeholder:text-subtle transition-colors"
            disabled={busy}
          />
        </div>

        {effectiveItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {effectiveItems.slice(0, 60).map((it, idx) => (
              <div
                key={`${String(it?.name || idx)}_${idx}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-panel border border-line text-sm text-text hover:border-muted transition-colors"
                title="Натисни, щоб редагувати кількість; × — прибрати"
              >
                <button
                  type="button"
                  onClick={() => editItemAt(idx)}
                  disabled={busy}
                  className="text-left"
                  aria-label={`Редагувати ${it?.name || "продукт"}`}
                >
                  {it?.name || "—"}
                  {it?.qty != null && it?.unit
                    ? ` · ${it.qty} ${it.unit}`
                    : it?.qty != null
                      ? ` · ${it.qty}`
                      : ""}
                </button>
                <button
                  type="button"
                  onClick={() => removeItemAtOrByName(idx, it?.name)}
                  disabled={busy}
                  className="ml-1 w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  aria-label={`Прибрати ${it?.name || "продукт"}`}
                  title="Прибрати"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-subtle">
          Збережено: <span className="text-text">{pantryItemsLength ? `${pantryItemsLength} позицій` : "—"}</span>
          {pantryItemsLength > 0 && (
            <>
              {" "}
              · <span className="text-text">{pantrySummary}</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

