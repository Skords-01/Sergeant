import { useRef, useState, useEffect } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { MEAL_TYPES } from "../lib/mealTypes.js";

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function emptyForm(photoResult) {
  const macros = photoResult?.macros || {};
  return {
    name: photoResult?.dishName || "",
    mealType: "breakfast",
    time: currentTime(),
    kcal: macros.kcal != null ? String(Math.round(macros.kcal)) : "",
    protein_g: macros.protein_g != null ? String(Math.round(macros.protein_g)) : "",
    fat_g: macros.fat_g != null ? String(Math.round(macros.fat_g)) : "",
    carbs_g: macros.carbs_g != null ? String(Math.round(macros.carbs_g)) : "",
    err: "",
  };
}

export function AddMealSheet({ open, onClose, onSave, photoResult, mealTemplates = [], setPrefs }) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => emptyForm(null));

  useDialogFocusTrap(open, ref, { onEscape: onClose });

  useEffect(() => {
    if (open) setForm(emptyForm(photoResult));
  }, [open, photoResult]);

  if (!open) return null;

  function field(key) {
    return (v) => setForm((s) => ({ ...s, [key]: v, err: "" }));
  }

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      setForm((s) => ({ ...s, err: "Введіть назву страви." }));
      return;
    }
    const kcal = form.kcal === "" ? 0 : Number(form.kcal);
    const protein_g = form.protein_g === "" ? 0 : Number(form.protein_g);
    const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
    const carbs_g = form.carbs_g === "" ? 0 : Number(form.carbs_g);
    if ([kcal, protein_g, fat_g, carbs_g].some((n) => !Number.isFinite(n))) {
      setForm((s) => ({ ...s, err: "Некоректне значення КБЖВ." }));
      return;
    }
    const mealLabel = MEAL_TYPES.find((m) => m.id === form.mealType)?.label || "Прийом їжі";
    onSave({
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: form.time || currentTime(),
      mealType: form.mealType,
      label: mealLabel,
      name,
      macros: { kcal, protein_g, fat_g, carbs_g },
      source: photoResult ? "photo" : "manual",
    });
  }

  const hasPhotoMacros =
    photoResult?.macros &&
    Object.values(photoResult.macros).some((v) => v != null && v !== 0);

  return (
    <div className="fixed inset-0 flex items-end z-[120]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Закрити"
        onClick={onClose}
      />
      <div
        ref={ref}
        className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[90dvh] overflow-y-auto"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-meal-sheet-title"
      >
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-panel z-10">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div id="add-meal-sheet-title" className="text-lg font-extrabold text-text">
              Додати прийом їжі
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>

          {Array.isArray(mealTemplates) && mealTemplates.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                Шаблони
              </div>
              <div className="flex flex-wrap gap-2">
                {mealTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setForm((s) => ({
                        ...s,
                        name: t.name,
                        mealType: t.mealType || "snack",
                        kcal: t.macros?.kcal != null ? String(Math.round(t.macros.kcal)) : "",
                        protein_g: t.macros?.protein_g != null ? String(Math.round(t.macros.protein_g)) : "",
                        fat_g: t.macros?.fat_g != null ? String(Math.round(t.macros.fat_g)) : "",
                        carbs_g: t.macros?.carbs_g != null ? String(Math.round(t.macros.carbs_g)) : "",
                        err: "",
                      }))
                    }
                    className="px-2 py-1 rounded-lg text-xs border border-line bg-panelHi hover:border-nutrition/50"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Мілі */}
          <div className="mb-4">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
              Мілі
            </div>
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt.id}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, mealType: mt.id }))}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all",
                    form.mealType === mt.id
                      ? "bg-nutrition text-white border-nutrition"
                      : "bg-panelHi text-muted border-line hover:border-nutrition/50",
                  )}
                >
                  {mt.emoji} {mt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Назва + час */}
          <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
            <div>
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                Назва страви
              </div>
              <Input
                value={form.name}
                onChange={(e) => field("name")(e.target.value)}
                placeholder="Вівсянка з бананом"
                aria-label="Назва страви"
              />
            </div>
            <div>
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                Час
              </div>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => field("time")(e.target.value)}
                aria-label="Час"
                className="w-[100px]"
              />
            </div>
          </div>

          {/* КБЖВ */}
          <div className="mb-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                КБЖВ
              </div>
              {hasPhotoMacros && (
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, ...emptyForm(photoResult), mealType: s.mealType, time: s.time, name: s.name, err: "" }))}
                  className="text-[11px] text-nutrition font-semibold hover:underline"
                >
                  ← З результату фото
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "kcal", label: "Ккал", placeholder: "350" },
                { key: "protein_g", label: "Білки г", placeholder: "12" },
                { key: "fat_g", label: "Жири г", placeholder: "6" },
                { key: "carbs_g", label: "Вуглев. г", placeholder: "60" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                    {label}
                  </div>
                  <Input
                    value={form[key]}
                    onChange={(e) => field(key)(e.target.value)}
                    inputMode="decimal"
                    placeholder={placeholder}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
          </div>

          {form.err && <div className="text-xs text-danger mt-2">{form.err}</div>}

          {typeof setPrefs === "function" && (
            <div className="mt-3">
              <button
                type="button"
                className="text-xs text-nutrition font-semibold hover:underline"
                onClick={() => {
                  const name = form.name.trim();
                  if (!name) {
                    setForm((s) => ({ ...s, err: "Спочатку введіть назву для шаблону." }));
                    return;
                  }
                  const kcal = form.kcal === "" ? 0 : Number(form.kcal);
                  const protein_g = form.protein_g === "" ? 0 : Number(form.protein_g);
                  const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
                  const carbs_g = form.carbs_g === "" ? 0 : Number(form.carbs_g);
                  if ([kcal, protein_g, fat_g, carbs_g].some((n) => !Number.isFinite(n))) {
                    setForm((s) => ({ ...s, err: "Некоректне КБЖВ для шаблону." }));
                    return;
                  }
                  setPrefs((p) => ({
                    ...p,
                    mealTemplates: [
                      ...(Array.isArray(p.mealTemplates) ? p.mealTemplates : []),
                      {
                        id: `tpl_${Date.now()}`,
                        name,
                        mealType: form.mealType,
                        macros: { kcal, protein_g, fat_g, carbs_g },
                      },
                    ].slice(0, 40),
                  }));
                }}
              >
                + Зберегти як шаблон
              </button>
            </div>
          )}

          {/* Кнопки */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
              onClick={handleSave}
            >
              Зберегти
            </Button>
            <Button type="button" variant="ghost" className="h-12 min-h-[44px]" onClick={onClose}>
              Скасувати
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
