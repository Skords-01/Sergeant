import { useEffect, useRef } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { recoveryConflictsForExercise } from "../../lib/recoveryConflict";
import { FIZRUK_SHEET_PAD_CLASS, SHEET_Z } from "../../lib/workoutUi";

export function ExercisePickerSheet({
  open,
  onClose,
  pickQ,
  onPickQ,
  pickList,
  pickGrouped,
  primaryGroupsUk,
  recBy,
  activeWorkoutId,
  pendingPick,
  onPendingPick,
  onAddExercise,
}) {
  const sheetRef = useRef(null);
  const searchRef = useRef(null);
  useDialogFocusTrap(open, sheetRef, { onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={cn("fixed inset-0 flex items-end fizruk-sheet", SHEET_Z)}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
      <div
        ref={sheetRef}
        className={cn(
          "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft",
          FIZRUK_SHEET_PAD_CLASS,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ex-picker-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>
        <div className="px-5 pb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div
                id="ex-picker-title"
                className="text-lg font-extrabold text-text leading-tight"
              >
                Додати вправу в тренування
              </div>
              <div className="text-xs text-subtle mt-1">
                Почни вводити назву
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>

          <div className="relative mb-3">
            <Input
              ref={searchRef}
              placeholder="Пошук вправи…"
              value={pickQ}
              onChange={(e) => onPickQ(e.target.value)}
              aria-label="Пошук вправи"
            />
          </div>

          {pendingPick && (
            <div className="mb-3 rounded-2xl border border-warning/50 bg-warning/10 p-4">
              <div className="text-sm font-bold text-warning mb-2">
                Мʼязи ще відновлюються
              </div>
              {(() => {
                const cf = recoveryConflictsForExercise(pendingPick, recBy);
                return (
                  <div className="text-xs text-warning/90 leading-relaxed space-y-1">
                    {cf.red.length ? (
                      <div>
                        <span className="font-semibold">
                          Рано навантажувати:
                        </span>{" "}
                        {cf.red.map((x) => x.label).join(", ")}
                      </div>
                    ) : null}
                    {cf.yellow.length ? (
                      <div>
                        <span className="font-semibold">Краще почекати:</span>{" "}
                        {cf.yellow.map((x) => x.label).join(", ")}
                      </div>
                    ) : null}
                  </div>
                );
              })()}
              <div className="flex gap-2 mt-3">
                <Button
                  className="flex-1 h-11"
                  onClick={() => onAddExercise(pendingPick)}
                >
                  Все одно додати
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 h-11"
                  onClick={() => onPendingPick(null)}
                >
                  Назад
                </Button>
              </div>
            </div>
          )}

          <div className="bg-bg border border-line rounded-2xl overflow-hidden max-h-[55vh] overflow-y-auto">
            {pickList.length === 0 && pickQ && (
              <div className="p-6 text-center text-sm text-subtle">
                Нічого не знайдено
              </div>
            )}
            {pickQ
              ? pickList.map((ex) => {
                  const pickCf = recoveryConflictsForExercise(ex, recBy);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                        pickCf.hasWarning && "border-l-4 border-l-warning/70",
                      )}
                      onClick={() => {
                        if (!activeWorkoutId) return;
                        if (pickCf.hasWarning) {
                          onPendingPick(ex);
                          return;
                        }
                        onAddExercise(ex);
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-semibold text-text truncate">
                          {ex?.name?.uk || ex?.name?.en}
                        </div>
                        {pickCf.hasWarning && (
                          <span className="text-warning text-xs shrink-0">
                            ⚠
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-subtle mt-0.5">
                        {primaryGroupsUk[ex.primaryGroup] || ex.primaryGroup}
                      </div>
                    </button>
                  );
                })
              : pickGrouped.map((g) => (
                  <div key={g.id}>
                    <div className="px-4 py-2 bg-panelHi/80 border-b border-line sticky top-0">
                      <span className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                        {g.label}
                      </span>
                    </div>
                    {g.items.map((ex) => {
                      const pickCf = recoveryConflictsForExercise(ex, recBy);
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                            pickCf.hasWarning &&
                              "border-l-4 border-l-warning/70",
                          )}
                          onClick={() => {
                            if (!activeWorkoutId) return;
                            if (pickCf.hasWarning) {
                              onPendingPick(ex);
                              return;
                            }
                            onAddExercise(ex);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-sm font-semibold text-text truncate">
                              {ex?.name?.uk || ex?.name?.en}
                            </div>
                            {pickCf.hasWarning && (
                              <span className="text-warning text-xs shrink-0">
                                ⚠
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
