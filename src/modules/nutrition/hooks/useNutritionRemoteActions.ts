import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "@tanstack/react-query";
import { nutritionApi } from "@shared/api";
import { formatNutritionError } from "../lib/nutritionErrors.js";
import { writeRecipeCache } from "../lib/recipeCache.js";
import { stableRecipeId } from "../lib/recipeIds.js";
import { getDayMacros, getDaySummary } from "../lib/nutritionStorage.js";

type AnySetter<T = unknown> =
  | Dispatch<SetStateAction<T>>
  | ((value: T) => void);

interface BuildMutationHandlersParams<TData> {
  setBusy?: AnySetter<boolean>;
  setErr?: AnySetter<string>;
  setStatusText?: AnySetter<string>;
  fallbackError: string;
  onSuccessSideEffects?: (data: TData) => void;
  onMutateSideEffects?: {
    statusText?: string;
    run?: () => void;
  };
}

/**
 * React Query mutation factory — wraps a `postJson` call and wires the
 * shared `setBusy` / `setErr` / `setStatusText` lifecycle so the hook's
 * public surface stays identical to the pre-RQ version.
 *
 * `statusText` is set on mutate and cleared on settle; `busy` flags (per
 * action) and error banner mirror the previous try/catch/finally shape.
 */
function buildMutationHandlers<TData>({
  setBusy,
  setErr,
  setStatusText,
  fallbackError,
  onSuccessSideEffects,
  onMutateSideEffects,
}: BuildMutationHandlersParams<TData>) {
  return {
    onMutate: () => {
      setBusy?.(true);
      setErr?.("");
      if (setStatusText && onMutateSideEffects?.statusText) {
        setStatusText(onMutateSideEffects.statusText);
      }
      onMutateSideEffects?.run?.();
    },
    onSuccess: (data: TData) => {
      onSuccessSideEffects?.(data);
    },
    onError: (err: unknown) => {
      setErr?.(formatNutritionError(err, fallbackError));
    },
    onSettled: () => {
      setBusy?.(false);
      if (setStatusText && onMutateSideEffects?.statusText) {
        setStatusText("");
      }
    },
  };
}

export interface UseNutritionRemoteActionsParams {
  setBusy: AnySetter<boolean>;
  setErr: AnySetter<string>;
  setStatusText: AnySetter<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pantry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prefs: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recipes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setRecipes: (value: any) => void;
  setRecipesRaw: (value: string) => void;
  setRecipesTried: (value: boolean) => void;
  recipeCacheKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weekPlan: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setWeekPlan: (value: any) => void;
  setWeekPlanRaw: (value: string) => void;
  setWeekPlanBusy: AnySetter<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDayPlan: Dispatch<SetStateAction<any>>;
  setDayPlanBusy: AnySetter<boolean>;
  setDayHintBusy: AnySetter<boolean>;
  setDayHintText: AnySetter<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shopping: any;
  setShoppingBusy: AnySetter<boolean>;
}

export function useNutritionRemoteActions({
  // shared state
  setBusy,
  setErr,
  setStatusText,
  // pantry + prefs
  pantry,
  prefs,
  // recipes
  recipes,
  setRecipes,
  setRecipesRaw,
  setRecipesTried,
  recipeCacheKey,
  // week plan
  weekPlan,
  setWeekPlan,
  setWeekPlanRaw,
  setWeekPlanBusy,
  // day plan / day hint
  setDayPlan,
  setDayPlanBusy,
  setDayHintBusy,
  setDayHintText,
  // log + shopping
  log,
  shopping,
  setShoppingBusy,
}: UseNutritionRemoteActionsParams) {
  // ─── Recipes ────────────────────────────────────────────────────────────
  const recipesMutation = useMutation({
    mutationFn: () => {
      const items = pantry.effectiveItems;
      if (items.length === 0)
        throw new Error("Дай хоча б 2–3 продукти для рецептів.");
      return nutritionApi.recommendRecipes({
        items: items.slice(0, 40),
        preferences: {
          goal: prefs.goal,
          servings: Number(prefs.servings) || 1,
          timeMinutes: Number(prefs.timeMinutes) || 25,
          exclude: String(prefs.exclude || ""),
          locale: "uk-UA",
        },
      });
    },
    ...buildMutationHandlers({
      setBusy,
      setErr,
      setStatusText,
      fallbackError: "Помилка рекомендацій",
      onMutateSideEffects: {
        statusText: "Генерую рецепти…",
        run: () => {
          setRecipes([]);
          setRecipesRaw("");
          setRecipesTried(true);
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSuccessSideEffects: (data: any) => {
        const list = Array.isArray(data?.recipes)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.recipes.map((r: any) => ({
              ...r,
              id: r?.id ? String(r.id) : stableRecipeId(r),
            }))
          : [];
        const raw = typeof data?.rawText === "string" ? data.rawText : "";
        setRecipes(list);
        setRecipesRaw(raw);
        writeRecipeCache(recipeCacheKey, { recipes: list, recipesRaw: raw });
      },
    }),
  });

  const recommendRecipes = useCallback(
    () => recipesMutation.mutate(),
    [recipesMutation],
  );

  // ─── Week plan ──────────────────────────────────────────────────────────
  const weekPlanMutation = useMutation({
    mutationFn: () => {
      const items = pantry.effectiveItems;
      if (items.length === 0) throw new Error("Додай продукти на склад.");
      return nutritionApi.weekPlan({
        items: items.slice(0, 50),
        preferences: { goal: prefs.goal },
        locale: "uk-UA",
      });
    },
    onMutate: () => {
      setWeekPlanBusy(true);
      setErr("");
      setWeekPlan(null);
      setWeekPlanRaw("");
    },
    onSuccess: (data) => {
      setWeekPlan(data?.plan || null);
      setWeekPlanRaw(typeof data?.rawText === "string" ? data.rawText : "");
    },
    onError: (err) => {
      setErr(formatNutritionError(err, "Помилка плану"));
    },
    onSettled: () => {
      setWeekPlanBusy(false);
    },
  });

  const fetchWeekPlan = useCallback(
    () => weekPlanMutation.mutate(),
    [weekPlanMutation],
  );

  // ─── Day hint ───────────────────────────────────────────────────────────
  const dayHintMutation = useMutation({
    mutationFn: () => {
      const summary = getDaySummary(log.nutritionLog, log.selectedDate);
      if (!summary.hasMeals) {
        // Return a synthetic payload so `onSuccess` can render the "empty day"
        // message without triggering an actual API call.
        return Promise.resolve({
          hint: "День порожній. Додай прийом їжі — і я зможу дати підказку.",
          _synthetic: true,
        });
      }
      const meals = log.nutritionLog?.[log.selectedDate]?.meals || [];
      const macroSources = meals.reduce(
        (
          acc: Record<string, number>,
          m: { macroSource?: string; source?: string },
        ) => {
          const k = String(
            m?.macroSource || (m?.source === "photo" ? "photoAI" : "manual"),
          );
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const macros = summary.hasAnyMacros
        ? getDayMacros(log.nutritionLog, log.selectedDate)
        : { kcal: null, protein_g: null, fat_g: null, carbs_g: null };
      return nutritionApi.dayHint({
        macros,
        hasMeals: summary.hasMeals,
        hasAnyMacros: summary.hasAnyMacros,
        macroSources,
        targets: {
          dailyTargetKcal: prefs.dailyTargetKcal,
          dailyTargetProtein_g: prefs.dailyTargetProtein_g,
          dailyTargetFat_g: prefs.dailyTargetFat_g,
          dailyTargetCarbs_g: prefs.dailyTargetCarbs_g,
        },
        locale: "uk-UA",
      });
    },
    onMutate: () => {
      setDayHintBusy(true);
      setErr("");
    },
    onSuccess: (data) => {
      setDayHintText(typeof data?.hint === "string" ? data.hint : "");
    },
    onError: (err) => {
      setErr(formatNutritionError(err, "Помилка підказки"));
    },
    onSettled: () => {
      setDayHintBusy(false);
    },
  });

  const fetchDayHint = useCallback(
    () => dayHintMutation.mutate(),
    [dayHintMutation],
  );

  // ─── Day plan ───────────────────────────────────────────────────────────
  const dayPlanMutation = useMutation({
    mutationFn: (regenerateMealType: string | null | undefined) =>
      nutritionApi
        .dayPlan({
          items: pantry.effectiveItems.slice(0, 50),
          targets: {
            kcal: prefs.dailyTargetKcal,
            protein_g: prefs.dailyTargetProtein_g,
            fat_g: prefs.dailyTargetFat_g,
            carbs_g: prefs.dailyTargetCarbs_g,
          },
          regenerateMealType: regenerateMealType || null,
          locale: "uk-UA",
        })
        .then((data) => {
          const plan = data?.plan;
          if (!plan) throw new Error("Не вдалося отримати план харчування");
          return { plan, regenerateMealType };
        }),
    onMutate: () => {
      setDayPlanBusy(true);
      setErr("");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: ({
      plan,
      regenerateMealType,
    }: {
      plan: any;
      regenerateMealType: string | null | undefined;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDayPlan((prev: any) => {
        if (regenerateMealType && prev?.meals?.length > 0) {
          const newMeals = Array.isArray(plan.meals) ? plan.meals : [];
          const merged = [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...prev.meals.filter((m: any) => m.type !== regenerateMealType),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...newMeals.filter((m: any) => m.type === regenerateMealType),
          ];
          interface PlanTotals {
            totalKcal?: number;
            totalProtein_g?: number;
            totalFat_g?: number;
            totalCarbs_g?: number;
          }
          const totals = merged.reduce<PlanTotals>(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (acc, m: any) => ({
              totalKcal: (acc.totalKcal ?? 0) + (m.kcal ?? 0),
              totalProtein_g: (acc.totalProtein_g ?? 0) + (m.protein_g ?? 0),
              totalFat_g: (acc.totalFat_g ?? 0) + (m.fat_g ?? 0),
              totalCarbs_g: (acc.totalCarbs_g ?? 0) + (m.carbs_g ?? 0),
            }),
            {},
          );
          return { ...prev, meals: merged, ...totals };
        }
        return plan;
      });
    },
    onError: (err) => {
      setErr(formatNutritionError(err, "Помилка генерації плану"));
    },
    onSettled: () => {
      setDayPlanBusy(false);
    },
  });

  const fetchDayPlan = useCallback(
    (regenerateMealType?: string | null) =>
      dayPlanMutation.mutate(regenerateMealType),
    [dayPlanMutation],
  );

  // ─── Add meal from plan (local-only; no network) ────────────────────────
  interface PlanMealInput {
    type?: string;
    name?: string;
    kcal?: number | null;
    protein_g?: number | null;
    fat_g?: number | null;
    carbs_g?: number | null;
  }
  const addMealFromPlan = useCallback(
    (meal: PlanMealInput) => {
      const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const typeLabels: Record<string, string> = {
        breakfast: "Сніданок",
        lunch: "Обід",
        dinner: "Вечеря",
        snack: "Перекус",
      };
      log.handleAddMeal({
        id,
        time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
        mealType: meal.type || "snack",
        label: (meal.type ? typeLabels[meal.type] : undefined) || "Прийом їжі",
        name: meal.name || "Страва",
        macros: {
          kcal: meal.kcal ?? null,
          protein_g: meal.protein_g ?? null,
          fat_g: meal.fat_g ?? null,
          carbs_g: meal.carbs_g ?? null,
        },
        source: "manual",
        macroSource: "recipeAI",
      });
    },
    [log],
  );

  // ─── Shopping list ──────────────────────────────────────────────────────
  const shoppingMutation = useMutation({
    mutationFn: (source: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        pantryItems: pantry.effectiveItems.slice(0, 50),
        locale: "uk-UA",
      };
      if (source === "weekplan" && weekPlan?.days?.length > 0) {
        body.weekPlan = weekPlan;
      } else if (recipes.length > 0) {
        body.recipes = recipes;
      } else {
        throw new Error("Немає рецептів чи тижневого плану для генерації.");
      }
      return nutritionApi.shoppingList(body).then((data) => {
        if (!Array.isArray(data?.categories))
          throw new Error("Не вдалося згенерувати список покупок.");
        return data;
      });
    },
    onMutate: () => {
      setShoppingBusy(true);
      setErr("");
    },
    onSuccess: (data) => {
      shopping.setGeneratedList(data.categories);
    },
    onError: (err) => {
      setErr(formatNutritionError(err, "Помилка генерації списку покупок"));
    },
    onSettled: () => {
      setShoppingBusy(false);
    },
  });

  const generateShoppingList = useCallback(
    (source: string) => shoppingMutation.mutate(source),
    [shoppingMutation],
  );

  return {
    recommendRecipes,
    fetchWeekPlan,
    fetchDayHint,
    fetchDayPlan,
    addMealFromPlan,
    generateShoppingList,
  };
}
