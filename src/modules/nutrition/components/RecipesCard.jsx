import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";

export function RecipesCard({
  busy,
  activePantry,
  prefs,
  setPrefs,
  recommendRecipes,
  recipes,
  recipesTried,
  recipesRaw,
  err,
  fmtMacro,
}) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-text">
        Рецепти ({activePantry?.name || "Склад"})
      </div>
      <div className="text-xs text-subtle mt-0.5">
        Рекомендації на базі продуктів зі складу. Можна вказати час, порції та “не хочу”.
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] text-subtle mb-1">Ціль</div>
            <select
              value={prefs.goal}
              onChange={(e) => setPrefs((p) => ({ ...p, goal: e.target.value }))}
              className="w-full h-11 rounded-2xl bg-panel border border-line px-4 text-sm text-text outline-none focus:border-nutrition/60"
              disabled={busy}
            >
              <option value="balanced">Збалансовано</option>
              <option value="high_protein">Більше білка</option>
              <option value="low_cal">Менше калорій</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-subtle mb-1">Порції</div>
              <Input
                value={String(prefs.servings)}
                onChange={(e) => setPrefs((p) => ({ ...p, servings: e.target.value }))}
                inputMode="numeric"
                disabled={busy}
              />
            </div>
            <div>
              <div className="text-[11px] text-subtle mb-1">Хвилин</div>
              <Input
                value={String(prefs.timeMinutes)}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, timeMinutes: e.target.value }))
                }
                inputMode="numeric"
                disabled={busy}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] text-subtle mb-1">Не використовувати / алергени</div>
          <Input
            value={prefs.exclude}
            onChange={(e) => setPrefs((p) => ({ ...p, exclude: e.target.value }))}
            placeholder="напр. арахіс, гриби"
            disabled={busy}
          />
        </div>

        <button
          type="button"
          onClick={recommendRecipes}
          disabled={busy}
          className={cn(
            "w-full h-11 rounded-2xl text-sm font-semibold",
            "bg-nutrition text-white hover:bg-nutrition-hover disabled:opacity-50",
          )}
        >
          Запропонувати рецепти
        </button>

        {recipes.length > 0 && (
          <div className="grid gap-3">
            {recipes.map((r, idx) => (
              <div key={idx} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">
                      {r.title || `Рецепт ${idx + 1}`}
                    </div>
                    <div className="text-xs text-subtle mt-1">
                      {r.timeMinutes ? `${r.timeMinutes} хв` : "—"} ·{" "}
                      {r.servings ? `${r.servings} порц.` : "—"}
                    </div>
                  </div>
                  {r.macros?.kcal != null && (
                    <div className="shrink-0 rounded-xl border border-line bg-bg px-3 py-2 text-xs text-subtle">
                      <div className="text-[10px] text-subtle">≈ ккал</div>
                      <div className="text-sm font-semibold text-text">
                        {fmtMacro(r.macros.kcal)}
                      </div>
                    </div>
                  )}
                </div>

                {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
                  <div className="mt-3 text-sm text-text">
                    <div className="text-xs text-subtle mb-1">Інгредієнти</div>
                    {r.ingredients.join(", ")}
                  </div>
                )}

                {Array.isArray(r.steps) && r.steps.length > 0 && (
                  <div className="mt-3 text-sm text-text">
                    <div className="text-xs text-subtle mb-1">Кроки</div>
                    <ol className="list-decimal pl-5 space-y-1">
                      {r.steps.slice(0, 10).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {Array.isArray(r.tips) && r.tips.length > 0 && (
                  <div className="mt-3 text-sm text-text">
                    <div className="text-xs text-subtle mb-1">Поради</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {r.tips.slice(0, 6).map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {recipesTried && !busy && recipes.length === 0 && !err && (
          <div className="rounded-2xl border border-line bg-panel p-4 text-sm text-subtle">
            Рецептів не повернулося. Спробуй натиснути “Розібрати” або додати 2–3 базові
            продукти (яйця/крупа/овочі).
            {recipesRaw && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted hover:text-text">
                  Показати діагностику (raw відповідь AI)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-subtle bg-bg border border-line rounded-xl p-3 max-h-64 overflow-auto">
                  {recipesRaw}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

