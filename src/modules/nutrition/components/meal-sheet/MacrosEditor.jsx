import { Input } from "@shared/components/ui/Input";
import { emptyForm } from "./mealFormUtils.js";

export function MacrosEditor({
  form,
  field,
  setForm,
  pickedFood,
  setPickedFood,
  photoResult,
  hasPhotoMacros,
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
          {pickedFood ? "КБЖВ (редагувати вручну)" : "КБЖВ"}
        </div>
        {hasPhotoMacros && (
          <button
            type="button"
            onClick={() =>
              setForm((s) => ({
                ...s,
                ...emptyForm(photoResult),
                mealType: s.mealType,
                time: s.time,
                name: s.name,
                err: "",
              }))
            }
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
              onChange={(e) => {
                if (pickedFood) setPickedFood(null);
                field(key)(e.target.value);
              }}
              inputMode="decimal"
              placeholder={placeholder}
              aria-label={label}
            />
          </div>
        ))}
      </div>
      {pickedFood && (
        <div className="text-[11px] text-subtle mt-1.5">
          Редагування вручну відʼєднає від продукту
        </div>
      )}
    </div>
  );
}
