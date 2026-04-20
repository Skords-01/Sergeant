import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/components/ui/Button";
import { nutritionKeys } from "@shared/lib/queryKeys.js";
import { upsertFood } from "../../lib/foodDb/foodDb.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SaveAsFoodProps {
  form: any;
  setForm: (updater: (s: any) => any) => void;
  setPickedFood: (p: any) => void;
  setPickedGrams: (g: string) => void;
  setFoodQuery: (q: string) => void;
  setFoodErr: (e: string) => void;
}

export function SaveAsFood({
  form,
  setForm,
  setPickedFood,
  setPickedGrams,
  setFoodQuery,
  setFoodErr,
}: SaveAsFoodProps) {
  const queryClient = useQueryClient();
  return (
    <div className="mt-3 mb-1">
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-xs"
        onClick={async () => {
          const name = String(form.name || "").trim();
          if (!name) {
            setForm((s) => ({
              ...s,
              err: "Введіть назву, щоб зберегти продукт.",
            }));
            return;
          }
          const kcal = form.kcal === "" ? 0 : Number(form.kcal);
          const protein_g = form.protein_g === "" ? 0 : Number(form.protein_g);
          const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
          const carbs_g = form.carbs_g === "" ? 0 : Number(form.carbs_g);
          if (
            [kcal, protein_g, fat_g, carbs_g].some(
              (n) => !Number.isFinite(n) || n < 0,
            )
          ) {
            setForm((s) => ({
              ...s,
              err: "КБЖВ має бути числами (без від'ємних значень).",
            }));
            return;
          }
          const res = await upsertFood({
            name,
            per100: { kcal, protein_g, fat_g, carbs_g },
            defaultGrams: 100,
          });
          if (!res.ok) {
            setFoodErr(
              ("error" in res && res.error) || "Не вдалося зберегти продукт.",
            );
            return;
          }
          // Bust the food-search cache so the next search (including the
          // refetch triggered by `setFoodQuery(name)` below) sees the
          // freshly saved product instead of 5 min of stale results.
          // The `foodSearch` prefix matches both local (IndexedDB) and
          // OFF (OpenFoodFacts) sub-queries.
          queryClient.invalidateQueries({
            queryKey: nutritionKeys.foodSearch,
          });
          setPickedFood(res.product);
          setPickedGrams("100");
          setFoodQuery(name);
          setFoodErr("");
        }}
      >
        + Зберегти як продукт (на 100г)
      </Button>
    </div>
  );
}
