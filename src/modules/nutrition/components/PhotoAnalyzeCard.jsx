import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";

export function PhotoAnalyzeCard({
  busy,
  analyzePhoto,
  fileRef,
  onPickPhoto,
  photoPreviewUrl,
  photoResult,
  fmtMacro,
  portionGrams,
  setPortionGrams,
  refinePhoto,
  answers,
  setAnswers,
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">Аналіз фото страви</div>
          <div className="text-xs text-subtle mt-0.5">
            Повертає оцінку КБЖВ і питання для уточнення порції.
          </div>
        </div>
        <button
          type="button"
          onClick={analyzePhoto}
          disabled={busy}
          className={cn(
            "shrink-0 px-4 h-10 rounded-xl text-sm font-medium",
            "bg-nutrition text-white hover:bg-nutrition-hover disabled:opacity-50",
          )}
        >
          Аналізувати
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
          className="block w-full text-sm text-subtle file:mr-3 file:rounded-xl file:border file:border-line file:bg-panel file:px-3 file:py-2 file:text-sm file:font-medium file:text-text hover:file:border-muted"
          aria-label="Обрати фото страви"
          disabled={busy}
        />

        {photoPreviewUrl && (
          <div className="rounded-2xl border border-line overflow-hidden bg-panel">
            <img
              src={photoPreviewUrl}
              alt="Обране фото"
              className="w-full max-h-[320px] object-cover"
            />
          </div>
        )}

        {photoResult && (
          <div className="rounded-2xl border border-line bg-panel p-4">
            <div className="text-sm font-semibold text-text">
              {photoResult.dishName || "Результат"}
            </div>
            <div className="text-xs text-subtle mt-1">
              Впевненість:{" "}
              {photoResult.confidence != null
                ? `${Math.round(photoResult.confidence * 100)}%`
                : "—"}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-line bg-bg px-3 py-2">
                <div className="text-[11px] text-subtle">Ккал</div>
                <div className="font-semibold">{fmtMacro(photoResult.macros?.kcal)}</div>
              </div>
              <div className="rounded-xl border border-line bg-bg px-3 py-2">
                <div className="text-[11px] text-subtle">Б/Ж/В (г)</div>
                <div className="font-semibold">
                  {fmtMacro(photoResult.macros?.protein_g)}/{fmtMacro(photoResult.macros?.fat_g)}/
                  {fmtMacro(photoResult.macros?.carbs_g)}
                </div>
              </div>
            </div>

            {Array.isArray(photoResult.ingredients) && photoResult.ingredients.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-subtle mb-1">Інгредієнти</div>
                <div className="text-sm text-text">
                  {photoResult.ingredients
                    .map((x) => x.name)
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </div>
            )}

            {Array.isArray(photoResult.questions) && photoResult.questions.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-subtle mb-1">
                  Уточнення (щоб точніше порахувати)
                </div>
                <ul className="list-disc pl-5 text-sm text-text space-y-1">
                  {photoResult.questions.slice(0, 3).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>

                <div className="mt-3 grid gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-subtle mb-1">Порція (г) якщо знаєш</div>
                      <Input
                        value={portionGrams}
                        onChange={(e) => setPortionGrams(e.target.value)}
                        inputMode="decimal"
                        placeholder="напр. 320"
                        disabled={busy}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={refinePhoto}
                        disabled={busy}
                        className={cn(
                          "w-full h-11 rounded-2xl text-sm font-semibold",
                          "bg-panel border border-line text-text hover:border-muted disabled:opacity-50",
                        )}
                      >
                        Перерахувати
                      </button>
                    </div>
                  </div>

                  {photoResult.questions.slice(0, 3).map((q) => (
                    <div key={q}>
                      <div className="text-[11px] text-subtle mb-1">{q}</div>
                      <Input
                        value={answers[q] || ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                        placeholder="твоя відповідь…"
                        disabled={busy}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

