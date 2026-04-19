import { useMemo } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { Sheet } from "@shared/components/ui/Sheet";
import { cn } from "@shared/lib/cn";
import { useVisualKeyboardInset } from "@shared/hooks/useVisualKeyboardInset";

const EQUIPMENT_OPTIONS = [
  { id: "bodyweight", label: "Власна вага" },
  { id: "barbell", label: "Штанга" },
  { id: "dumbbell", label: "Гантелі" },
  { id: "kettlebell", label: "Гиря" },
  { id: "cable", label: "Блок/трос" },
  { id: "machine", label: "Тренажер" },
  { id: "band", label: "Еспандер/резинка" },
  { id: "bench", label: "Лава" },
  { id: "other", label: "Інше" },
];

function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toggleArr(arr, value) {
  const a = Array.isArray(arr) ? arr : [];
  return a.includes(value) ? a.filter((x) => x !== value) : [...a, value];
}

export function AddExerciseSheet({
  open,
  onClose,
  form,
  setForm,
  primaryGroupsUk,
  musclesUk,
  musclesByPrimaryGroup,
  addExercise,
}) {
  const kbInsetPx = useVisualKeyboardInset(open);

  const suggestedMuscles = useMemo(() => {
    const g = form.primaryGroup;
    const ids = musclesByPrimaryGroup?.[g] || [];
    return ids.filter((id) => musclesUk?.[id]);
  }, [form.primaryGroup, musclesByPrimaryGroup, musclesUk]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Додати вправу"
      description="Збережеться локально на цьому пристрої"
      closeLabel="Закрити форму"
      kbInsetPx={kbInsetPx}
      zIndex={100}
    >
      <div className="space-y-3">
        <Input
          placeholder="Назва (укр) *"
          value={form.nameUk}
          onChange={(e) => setForm((f) => ({ ...f, nameUk: e.target.value }))}
          aria-label="Назва вправи українською"
        />

        <div className="rounded-2xl border border-line bg-panelHi px-3">
          <div className="text-2xs font-bold text-subtle uppercase tracking-widest pt-2">
            Основна група
          </div>
          <select
            className="w-full min-h-[44px] bg-transparent text-sm text-text outline-none py-2"
            value={form.primaryGroup}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                primaryGroup: e.target.value,
                musclesPrimary: [],
                musclesSecondary: [],
              }))
            }
            aria-label="Основна група м'язів"
          >
            {Object.keys(primaryGroupsUk).map((id) => (
              <option key={id} value={id}>
                {primaryGroupsUk[id]}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
          <div className="text-2xs font-bold text-subtle uppercase tracking-widest">
            Обладнання
          </div>
          <div className="py-2 flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map((o) => {
              const active = (form.equipment || []).includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      equipment: toggleArr(f.equipment, o.id),
                    }))
                  }
                  className={cn(
                    "text-xs px-3 py-2.5 min-h-[44px] rounded-full border transition-colors",
                    active
                      ? "bg-text text-white border-text"
                      : "border-line bg-bg text-muted hover:border-muted hover:text-text",
                  )}
                  aria-pressed={active}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
          <div className="text-2xs font-bold text-subtle uppercase tracking-widest">
            Основні мʼязи
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestedMuscles.map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors",
                  (form.musclesPrimary || []).includes(id)
                    ? "bg-primary border-primary text-white"
                    : "border-line bg-bg text-muted hover:border-muted hover:text-text",
                )}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    musclesPrimary: toggleArr(f.musclesPrimary, id),
                  }))
                }
              >
                {musclesUk[id] || id}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
          <div className="text-2xs font-bold text-subtle uppercase tracking-widest">
            Супутні мʼязи
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestedMuscles.map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "text-xs px-3 py-2 min-h-[44px] rounded-full border transition-colors",
                  (form.musclesSecondary || []).includes(id)
                    ? "bg-text/80 border-text/80 text-white"
                    : "border-line bg-bg text-muted hover:border-muted hover:text-text",
                )}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    musclesSecondary: toggleArr(f.musclesSecondary, id),
                  }))
                }
              >
                {musclesUk[id] || id}
              </button>
            ))}
          </div>
        </div>

        <Input
          placeholder="Опис"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          className="h-12 min-h-[44px]"
          onClick={() => {
            const nameUk = (form.nameUk || "").trim();
            if (!nameUk) return;
            const id = `custom_${slugify(nameUk) || Date.now()}`;
            addExercise({
              id,
              name: { uk: nameUk, en: nameUk },
              primaryGroup: form.primaryGroup,
              primaryGroupUk:
                primaryGroupsUk[form.primaryGroup] || form.primaryGroup,
              muscles: {
                primary: form.musclesPrimary || [],
                secondary: form.musclesSecondary || [],
                stabilizers: [],
              },
              equipment: form.equipment || [],
              equipmentUk: (form.equipment || []).map(
                (eid) =>
                  EQUIPMENT_OPTIONS.find((x) => x.id === eid)?.label || eid,
              ),
              description: (form.description || "").trim(),
              source: "manual",
            });
            onClose();
            setForm({
              nameUk: "",
              primaryGroup: "chest",
              musclesPrimary: [],
              musclesSecondary: [],
              equipment: ["bodyweight"],
              description: "",
            });
          }}
        >
          Зберегти
        </Button>
        <Button variant="ghost" className="h-12 min-h-[44px]" onClick={onClose}>
          Скасувати
        </Button>
      </div>
    </Sheet>
  );
}
