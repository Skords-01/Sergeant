import { useState } from "react";

export function useNutritionUiState() {
  const [editingMeal, setEditingMeal] = useState(null);

  const [recipes, setRecipes] = useState([]);
  const [recipesTried, setRecipesTried] = useState(false);
  const [recipesRaw, setRecipesRaw] = useState("");

  const [weekPlan, setWeekPlan] = useState(null);
  const [weekPlanRaw, setWeekPlanRaw] = useState("");
  const [weekPlanBusy, setWeekPlanBusy] = useState(false);

  const [dayPlan, setDayPlan] = useState(null);
  const [dayPlanBusy, setDayPlanBusy] = useState(false);

  const [shoppingBusy, setShoppingBusy] = useState(false);

  const [dayHintText, setDayHintText] = useState("");
  const [dayHintBusy, setDayHintBusy] = useState(false);

  const [cloudBackupBusy, setCloudBackupBusy] = useState(false);
  const [backupPasswordDialog, setBackupPasswordDialog] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState(null);

  const [pantryScannerOpen, setPantryScannerOpen] = useState(false);
  const [pantryScanStatus, setPantryScanStatus] = useState("");

  return {
    editingMeal,
    setEditingMeal,
    recipes,
    setRecipes,
    recipesTried,
    setRecipesTried,
    recipesRaw,
    setRecipesRaw,
    weekPlan,
    setWeekPlan,
    weekPlanRaw,
    setWeekPlanRaw,
    weekPlanBusy,
    setWeekPlanBusy,
    dayPlan,
    setDayPlan,
    dayPlanBusy,
    setDayPlanBusy,
    shoppingBusy,
    setShoppingBusy,
    dayHintText,
    setDayHintText,
    dayHintBusy,
    setDayHintBusy,
    cloudBackupBusy,
    setCloudBackupBusy,
    backupPasswordDialog,
    setBackupPasswordDialog,
    restoreConfirm,
    setRestoreConfirm,
    pantryScannerOpen,
    setPantryScannerOpen,
    pantryScanStatus,
    setPantryScanStatus,
  };
}

