import { useRef } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { FIZRUK_SHEET_PAD_CLASS, SHEET_Z } from "../../lib/workoutUi";

export function ExerciseDetailSheet({
  selected,
  onClose,
  mode,
  musclesUk,
  rec,
  recoveryConflictsForExercise,
  activeWorkoutId,
  activeWorkout,
  addExerciseToActive,
  onDeleteRequest,
  toast,
}) {
  const sheetRef = useRef(null);
  useDialogFocusTrap(!!selected, sheetRef, { onEscape: onClose });

  if (!selected) return null;

  const cf = recoveryConflictsForExercise(selected, rec?.by);
  const isCustom =
    selected._custom ||
    selected.source === "manual" ||
    String(selected.id || "").startsWith("custom_");

  return (
    <div className={cn("fixed inset-0 flex items-end fizruk-sheet", SHEET_Z)}>
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Закрити"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn(
          "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft",
          FIZRUK_SHEET_PAD_CLASS,
        )}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fizruk-ex-details-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>
        <div className="px-5 pb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div
                id="fizruk-ex-details-title"
                className="text-lg font-extrabold text-text leading-tight"
              >
                {selected?.name?.uk || selected?.name?.en}
              </div>
              <div className="text-xs text-subtle mt-1">
                Основна група:{" "}
                <span className="font-semibold text-muted">
                  {selected.primaryGroupUk || selected.primaryGroup}
                </span>
                {selected.level ? (
                  <>
                    {" "}
                    · рівень:{" "}
                    <span className="font-semibold text-muted">
                      {selected.level}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {cf?.hasWarning && (
            <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning leading-snug">
              {cf.red?.length ? (
                <div>
                  <span className="font-semibold">Рано:</span>{" "}
                  {cf.red.map((x) => x.label).join(", ")}
                </div>
              ) : null}
              {cf.yellow?.length ? (
                <div className="mt-1">
                  <span className="font-semibold">Краще почекати:</span>{" "}
                  {cf.yellow.map((x) => x.label).join(", ")}
                </div>
              ) : null}
            </div>
          )}

          {(selected.images || []).filter(Boolean).length > 0 && (
            <div className="mb-4 -mx-5 px-5 overflow-x-auto no-scrollbar">
              <div className="flex gap-3">
                {selected.images.slice(0, 8).map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={selected?.name?.uk || selected?.name?.en || "exercise"}
                    loading="lazy"
                    decoding="async"
                    width="160"
                    height="160"
                    className="h-40 w-40 rounded-2xl object-cover border border-line bg-bg"
                  />
                ))}
              </div>
            </div>
          )}

          {selected.description && (
            <div className="text-sm text-text leading-relaxed mb-4">
              {selected.description}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest">
              Мʼязи
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(selected?.muscles?.primary || []).map((m) => (
                <span
                  key={m}
                  className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold"
                >
                  {musclesUk?.[m] || m} · основний
                </span>
              ))}
              {(selected?.muscles?.secondary || []).map((m) => (
                <span
                  key={m}
                  className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-subtle font-semibold"
                >
                  {musclesUk?.[m] || m}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest">
              Обладнання
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(selected.equipmentUk || selected.equipment || []).map((eq) => (
                <span
                  key={eq}
                  className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>

          {selected.tips?.length ? (
            <div className="mt-4">
              <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-2">
                Підказки
              </div>
              <ul className="space-y-1.5">
                {selected.tips.map((t, i) => (
                  <li key={i} className="text-sm text-text leading-relaxed">
                    <span className="text-muted font-bold mr-2">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isCustom && (
            <div className="mt-4">
              <Button
                variant="danger"
                className="w-full h-12"
                onClick={onDeleteRequest}
              >
                Видалити з каталогу
              </Button>
            </div>
          )}

          {mode === "log" && (
            <Button
              type="button"
              className="w-full h-12 mt-5 bg-fizruk text-white border-fizruk hover:bg-fizruk/90"
              onClick={() => {
                if (!activeWorkoutId) {
                  toast?.warning("Спочатку натисни «+ Нове» у блоці вище.");
                  return;
                }
                if (activeWorkout?.endedAt) {
                  toast?.warning(
                    "Це тренування вже завершено. Обери чернетку або створи нове.",
                  );
                  return;
                }
                addExerciseToActive(selected);
                onClose();
              }}
            >
              + Додати в активне тренування
            </Button>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button className="h-12" onClick={onClose}>
              Закрити
            </Button>
            <Button
              variant="ghost"
              className={cn("h-12")}
              onClick={() => {
                navigator.clipboard
                  ?.writeText(selected?.name?.uk || selected?.name?.en || "")
                  .catch(() => {});
              }}
            >
              📋 Копіювати назву
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
