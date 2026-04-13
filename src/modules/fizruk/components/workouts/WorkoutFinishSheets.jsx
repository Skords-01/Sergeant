import { useRef } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { formatDurShort } from "../../lib/workoutUi";

export function WorkoutFinishSheets({
  finishFlash,
  setFinishFlash,
  updateWorkout,
}) {
  const trapRef = useRef(null);
  useDialogFocusTrap(!!finishFlash, trapRef, {
    onEscape: () => setFinishFlash(null),
  });

  if (!finishFlash) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[100] px-4 pointer-events-none fizruk-above-tabbar"
      role="region"
      aria-label="Підсумок тренування"
    >
      <div
        ref={trapRef}
        className="pointer-events-auto max-w-4xl mx-auto fizruk-sheet"
      >
        {finishFlash.step === "wellbeing" && (
          <div
            className="rounded-2xl border border-line bg-panel p-4 shadow-float space-y-4 max-h-[min(70vh,520px)] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fizruk-wellbeing-title"
          >
            <div
              id="fizruk-wellbeing-title"
              className="text-sm font-bold text-text"
            >
              Самопочуття
            </div>
            <p className="text-xs text-subtle leading-relaxed">
              Оціни по шкалі 1–5 (можна пропустити).
            </p>
            <div>
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                Енергія
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={`e${n}`}
                    type="button"
                    className={cn(
                      "min-w-[44px] min-h-[44px] rounded-xl border text-sm font-semibold transition-colors",
                      finishFlash.energy === n
                        ? "bg-text text-white border-text"
                        : "border-line bg-bg text-muted hover:border-muted",
                    )}
                    onClick={() =>
                      setFinishFlash((f) => f && { ...f, energy: n })
                    }
                    aria-pressed={finishFlash.energy === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                Настрій
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={`m${n}`}
                    type="button"
                    className={cn(
                      "min-w-[44px] min-h-[44px] rounded-xl border text-sm font-semibold transition-colors",
                      finishFlash.mood === n
                        ? "bg-text text-white border-text"
                        : "border-line bg-bg text-muted hover:border-muted",
                    )}
                    onClick={() =>
                      setFinishFlash((f) => f && { ...f, mood: n })
                    }
                    aria-pressed={finishFlash.mood === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 h-12 min-h-[44px]"
                type="button"
                onClick={() =>
                  setFinishFlash((f) => f && { ...f, step: "summary" })
                }
              >
                Пропустити
              </Button>
              <Button
                className="flex-1 h-12 min-h-[44px]"
                type="button"
                onClick={() => {
                  const wid = finishFlash.workoutId;
                  if (wid && (finishFlash.energy || finishFlash.mood)) {
                    updateWorkout(wid, {
                      wellbeing: {
                        energy: finishFlash.energy ?? undefined,
                        mood: finishFlash.mood ?? undefined,
                      },
                    });
                  }
                  setFinishFlash(
                    (f) =>
                      f && {
                        ...f,
                        step: "summary",
                        savedWellbeing:
                          f.energy || f.mood
                            ? { energy: f.energy, mood: f.mood }
                            : null,
                      },
                  );
                }}
              >
                Зберегти
              </Button>
            </div>
          </div>
        )}

        {finishFlash.step === "summary" && finishFlash.collapsed && (
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 min-h-[44px] shadow-float text-left"
            onClick={() =>
              setFinishFlash((f) => f && { ...f, collapsed: false })
            }
          >
            <span className="text-sm font-semibold text-text">
              ✓ Результати
            </span>
            <span className="text-xs text-subtle tabular-nums">
              {formatDurShort(finishFlash.durationSec)}
            </span>
          </button>
        )}

        {finishFlash.step === "summary" && !finishFlash.collapsed && (
          <div className="rounded-2xl overflow-hidden border border-line shadow-float">
            <div className="fizruk-summary-header">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold tracking-widest uppercase text-accent">
                    Завершено
                  </div>
                  <div className="text-lg font-black text-white mt-1 leading-tight">
                    Тренування виконано
                  </div>
                </div>
                <button
                  type="button"
                  className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white text-lg"
                  aria-label="Закрити"
                  onClick={() => setFinishFlash(null)}
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-white/60">
                    Час
                  </div>
                  <div className="text-sm font-black text-white tabular-nums mt-0.5">
                    {formatDurShort(finishFlash.durationSec)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-white/60">
                    Вправ
                  </div>
                  <div className="text-lg font-black text-white tabular-nums">
                    {finishFlash.items}
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-white/60">
                    Обʼєм
                  </div>
                  <div className="text-sm font-black text-white tabular-nums mt-0.5">
                    {finishFlash.tonnageKg > 0
                      ? `${Math.round(finishFlash.tonnageKg)} кг`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
            {finishFlash.savedWellbeing &&
              (finishFlash.savedWellbeing.energy ||
                finishFlash.savedWellbeing.mood) && (
                <div className="px-4 py-2.5 bg-panel border-b border-line flex items-center gap-3 text-xs text-subtle">
                  <span>Самопочуття:</span>
                  <span className="font-semibold text-text">
                    енергія {finishFlash.savedWellbeing.energy ?? "—"}/5
                    {" · "}
                    настрій {finishFlash.savedWellbeing.mood ?? "—"}/5
                  </span>
                </div>
              )}
            <div className="flex gap-2 p-3 bg-panel">
              <Button
                variant="ghost"
                className="flex-1 h-12 min-h-[44px] rounded-full"
                type="button"
                onClick={() =>
                  setFinishFlash((f) => f && { ...f, collapsed: true })
                }
              >
                Згорнути
              </Button>
              <button
                type="button"
                className="fizruk-cta-accent flex-1 py-3 rounded-full text-[15px]"
                onClick={() => setFinishFlash(null)}
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
