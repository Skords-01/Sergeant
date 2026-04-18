import { useCallback } from "react";
import { postJson } from "../lib/nutritionApi.js";
import { writeRecipeCache } from "../lib/recipeCache.js";
import { stableRecipeId } from "../lib/recipeIds.js";
import { getDayMacros, getDaySummary } from "../lib/nutritionStorage.js";

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
  dayPlan,
  setDayPlan,
  setDayPlanBusy,
  setDayHintBusy,
  setDayHintText,
  // log + shopping
  log,
  shopping,
  setShoppingBusy,
}) {
  const recommendRecipes = async () => {
    setBusy(true);
    setErr("");
    setRecipes([]);
    setRecipesRaw("");
    setRecipesTried(true);
    setStatusText("Генерую рецепти…");
    try {
      const items = pantry.effectiveItems;
      if (items.length === 0)
        throw new Error("Дай хоча б 2–3 продукти для рецептів.");
      const data = await postJson("/api/nutrition/recommend-recipes", {
        items: items.slice(0, 40),
        preferences: {
          goal: prefs.goal,
          servings: Number(prefs.servings) || 1,
          timeMinutes: Number(prefs.timeMinutes) || 25,
          exclude: String(prefs.exclude || ""),
          locale: "uk-UA",
        },
      });
      const list = Array.isArray(data?.recipes)
        ? data.recipes.map((r) => ({
            ...r,
            id: r?.id ? String(r.id) : stableRecipeId(r),
          }))
        : [];
      const raw = typeof data?.rawText === "string" ? data.rawText : "";
      setRecipes(list);
      setRecipesRaw(raw);
      writeRecipeCache(recipeCacheKey, { recipes: list, recipesRaw: raw });
    } catch (e) {
      setErr(e?.message || "Помилка рекомендацій");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const fetchWeekPlan = async () => {
    setWeekPlanBusy(true);
    setErr("");
    setWeekPlan(null);
    setWeekPlanRaw("");
    try {
      const items = pantry.effectiveItems;
      if (items.length === 0) throw new Error("Додай продукти на склад.");
      const data = await postJson("/api/nutrition/week-plan", {
        items: items.slice(0, 50),
        preferences: { goal: prefs.goal },
        locale: "uk-UA",
      });
      setWeekPlan(data?.plan || null);
      setWeekPlanRaw(typeof data?.rawText === "string" ? data.rawText : "");
    } catch (e) {
      setErr(e?.message || "Помилка плану");
    } finally {
      setWeekPlanBusy(false);
    }
  };

  const fetchDayHint = useCallback(async () => {
    setDayHintBusy(true);
    setErr("");
    try {
      const summary = getDaySummary(log.nutritionLog, log.selectedDate);
      if (!summary.hasMeals) {
        setDayHintText(
          "День порожній. Додай прийом їжі — і я зможу дати підказку.",
        );
        return;
      }
      const meals = log.nutritionLog?.[log.selectedDate]?.meals || [];
      const macroSources = meals.reduce((acc, m) => {
        const k = String(
          m?.macroSource || (m?.source === "photo" ? "photoAI" : "manual"),
        );
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const macros = summary.hasAnyMacros
        ? getDayMacros(log.nutritionLog, log.selectedDate)
        : { kcal: null, protein_g: null, fat_g: null, carbs_g: null };
      const data = await postJson("/api/nutrition/day-hint", {
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
      setDayHintText(typeof data?.hint === "string" ? data.hint : "");
    } catch (e) {
      setErr(e?.message || "Помилка підказки");
    } finally {
      setDayHintBusy(false);
    }
  }, [
    log.nutritionLog,
    log.selectedDate,
    prefs,
    setDayHintBusy,
    setDayHintText,
    setErr,
  ]);

  const fetchDayPlan = useCallback(
    async (regenerateMealType) => {
      setDayPlanBusy(true);
      setErr("");
      try {
        const data = await postJson("/api/nutrition/day-plan", {
          items: pantry.effectiveItems.slice(0, 50),
          targets: {
            kcal: prefs.dailyTargetKcal,
            protein_g: prefs.dailyTargetProtein_g,
            fat_g: prefs.dailyTargetFat_g,
            carbs_g: prefs.dailyTargetCarbs_g,
          },
          regenerateMealType: regenerateMealType || null,
          locale: "uk-UA",
        });
        const plan = data?.plan;
        if (!plan) throw new Error("Не вдалося отримати план харчування");
        if (regenerateMealType && dayPlan?.meals?.length > 0) {
          const newMeals = Array.isArray(plan.meals) ? plan.meals : [];
          const merged = [
            ...dayPlan.meals.filter((m) => m.type !== regenerateMealType),
            ...newMeals.filter((m) => m.type === regenerateMealType),
          ];
          const totals = merged.reduce(
            (acc, m) => ({
              totalKcal: (acc.totalKcal ?? 0) + (m.kcal ?? 0),
              totalProtein_g: (acc.totalProtein_g ?? 0) + (m.protein_g ?? 0),
              totalFat_g: (acc.totalFat_g ?? 0) + (m.fat_g ?? 0),
              totalCarbs_g: (acc.totalCarbs_g ?? 0) + (m.carbs_g ?? 0),
            }),
            {},
          );
          setDayPlan({ ...dayPlan, meals: merged, ...totals });
        } else {
          setDayPlan(plan);
        }
      } catch (e) {
        setErr(e?.message || "Помилка генерації плану");
      } finally {
        setDayPlanBusy(false);
      }
    },
    [pantry.effectiveItems, prefs, dayPlan, setDayPlan, setDayPlanBusy, setErr],
  );

  const addMealFromPlan = useCallback(
    (meal) => {
      const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const typeLabels = {
        breakfast: "Сніданок",
        lunch: "Обід",
        dinner: "Вечеря",
        snack: "Перекус",
      };
      log.handleAddMeal({
        id,
        time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
        mealType: meal.type || "snack",
        label: typeLabels[meal.type] || "Прийом їжі",
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

  const generateShoppingList = useCallback(
    async (source) => {
      setShoppingBusy(true);
      setErr("");
      try {
        const body = {
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
        const data = await postJson("/api/nutrition/shopping-list", body);
        if (!Array.isArray(data?.categories))
          throw new Error("Не вдалося згенерувати список покупок.");
        shopping.setGeneratedList(data.categories);
      } catch (e) {
        setErr(e?.message || "Помилка генерації списку покупок");
      } finally {
        setShoppingBusy(false);
      }
    },
    [
      pantry.effectiveItems,
      recipes,
      weekPlan,
      shopping,
      setShoppingBusy,
      setErr,
    ],
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
