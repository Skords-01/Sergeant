import { useEffect, useRef, useState } from "react";
import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";

const TEMPLATES = [
  { id: "quickBreakfast", label: "Сніданок", emoji: "🍳" },
  { id: "quickLunch", label: "Обід", emoji: "🍗" },
  { id: "quickFitness", label: "Фітнес", emoji: "💪" },
];

const COLLAPSE_THRESHOLD = 12;

function InventoryCard({
  effectiveItems,
  editItemAt,
  removeItemAtOrByName,
  pantryItemsLength,
  pantrySummary,
  busy,
}) {
  const userToggledRef = useRef(false);
  const [expanded, setExpanded] = useState(effectiveItems.length <= COLLAPSE_THRESHOLD);

  useEffect(() => {
    if (userToggledRef.current) return;
    setExpanded(effectiveItems.length <= COLLAPSE_THRESHOLD);
  }, [effectiveItems.length]);

  if (effectiveItems.length === 0) return null;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => {
          userToggledRef.current = true;
          setExpanded((v) => !v);
        }}
        className="flex items-center justify-between w-full gap-2 mb-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("transition-transform shrink-0", expanded && "rotate-90")}
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-semibold text-text">Мій склад</span>
          <span className="text-xs text-subtle font-medium">
            ({pantryItemsLength} позицій)
          </span>
        </div>
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-2 mt-1">
          {effectiveItems.slice(0, 60).map((it, idx) => (
            <div
              key={`${String(it?.name || idx)}_${idx}`}
              className={cn(
                "flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full",
                "bg-nutrition/10 border border-nutrition/20 text-sm text-text",
                "hover:bg-nutrition/20 hover:border-nutrition/35 transition-colors",
              )}
              title="Натисни назву, щоб редагувати кількість; × — прибрати"
            >
              <button
                type="button"
                onClick={() => editItemAt(idx)}
                disabled={busy}
                className="text-left font-medium"
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
                className="w-5 h-5 rounded-full flex items-center justify-center text-nutrition/50 hover:text-danger hover:bg-danger/10 transition-colors text-base leading-none"
                aria-label={`Прибрати ${it?.name || "продукт"}`}
                title="Прибрати"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {pantryItemsLength > 0 && (
        <div className={cn("text-xs text-subtle pt-2 border-t border-line/50", expanded ? "mt-3" : "mt-1")}>
          <span className="font-semibold text-text">
            {pantryItemsLength} позицій
          </span>
          {" · "}
          <span>{pantrySummary}</span>
        </div>
      )}
    </Card>
  );
}

export function PantryCard({
  busy,
  activePantry: _activePantry,
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
  const [listOpen, setListOpen] = useState(false);

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">Додати продукти</div>
            <div className="text-xs text-subtle mt-0.5">
              Нові мерджаться зі старими
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                disabled={busy}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-medium shrink-0",
                  "bg-nutrition/10 border border-nutrition/20 text-text",
                  "hover:bg-nutrition/20 hover:border-nutrition/40 transition-colors",
                  "disabled:opacity-40",
                )}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItemName.trim()) {
                  upsertItem(newItemName);
                  setNewItemName("");
                }
              }}
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
                "bg-nutrition text-white hover:bg-nutrition-hover disabled:opacity-50 transition-colors",
              )}
            >
              Додати
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="flex items-center gap-2 text-xs text-subtle hover:text-text transition-colors font-medium"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-transform", listOpen && "rotate-90")}
                aria-hidden
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {listOpen ? "Сховати текстовий список" : "Вставити список текстом"}
            </button>
            {listOpen && (
              <div className="mt-2 flex gap-2 items-start">
                <textarea
                  value={pantryText}
                  onChange={(e) => setPantryText(e.target.value)}
                  placeholder={'Напр.: "2 яйця, курка, рис, огірки, сир, йогурт"'}
                  className="flex-1 min-h-[96px] rounded-2xl bg-panel border border-line px-4 py-3 text-sm text-text outline-none focus:border-nutrition/60 placeholder:text-subtle transition-colors"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await parsePantry();
                    if (ok) setListOpen(false);
                  }}
                  disabled={busy || !pantryText.trim()}
                  className={cn(
                    "shrink-0 px-4 h-11 rounded-xl text-sm font-semibold mt-0.5",
                    "bg-nutrition text-white hover:bg-nutrition-hover disabled:opacity-50 transition-colors",
                  )}
                >
                  Розібрати
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <InventoryCard
        effectiveItems={effectiveItems}
        editItemAt={editItemAt}
        removeItemAtOrByName={removeItemAtOrByName}
        pantryItemsLength={pantryItemsLength}
        pantrySummary={pantrySummary}
        busy={busy}
      />
    </>
  );
}
