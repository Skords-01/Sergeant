import { cn } from "@shared/lib/cn";

export function NutritionHeader({
  busy,
  activePage,
  setActivePage,
  pantries,
  activePantry,
  activePantryId,
  setActivePantryId,
  renameActivePantry,
  deleteActivePantry,
  createPantry,
}) {
  return (
    <div className="mb-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-text tracking-tight">Харчування</h1>
        <div className="flex items-center gap-2">
          <select
            value={activePantry?.id || activePantryId || ""}
            onChange={(e) => setActivePantryId(e.target.value)}
            disabled={busy}
            className="h-9 rounded-xl bg-panel border border-line px-3 text-sm text-text outline-none focus:border-primary/60"
            aria-label="Обрати склад продуктів"
          >
            {(Array.isArray(pantries) ? pantries : []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Склад"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={renameActivePantry}
            disabled={busy}
            className="h-9 px-3 rounded-xl bg-panel border border-line text-sm text-text hover:border-muted transition-colors disabled:opacity-50"
            title="Перейменувати склад"
            aria-label="Перейменувати склад"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={deleteActivePantry}
            disabled={busy}
            className="h-9 px-3 rounded-xl bg-panel border border-line text-sm text-danger hover:border-muted transition-colors disabled:opacity-50"
            title="Видалити склад"
            aria-label="Видалити склад"
          >
            🗑
          </button>
          <button
            type="button"
            onClick={createPantry}
            disabled={busy}
            className="h-9 px-3 rounded-xl bg-panel border border-line text-sm text-text hover:border-muted transition-colors disabled:opacity-50"
          >
            + Склад
          </button>
        </div>
      </div>
      <p className="text-sm text-subtle mt-1">
        Фото → приблизне КБЖВ · голос/текст → інгредієнти · рецепти з порадами
      </p>

      <div className="mt-4 flex gap-2">
        {[
          { id: "products", label: "Продукти" },
          { id: "recipes", label: "Рецепти" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActivePage(t.id)}
            className={cn(
              "h-10 px-4 rounded-2xl text-sm font-semibold border transition-colors",
              activePage === t.id
                ? "bg-primary text-white border-primary"
                : "bg-panel text-text border-line hover:border-muted",
            )}
            disabled={busy}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

