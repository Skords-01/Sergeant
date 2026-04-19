import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import analyzePhoto from "../modules/nutrition/analyze-photo.js";
import parsePantry from "../modules/nutrition/parse-pantry.js";
import refinePhoto from "../modules/nutrition/refine-photo.js";
import recommendRecipes from "../modules/nutrition/recommend-recipes.js";
import dayHint from "../modules/nutrition/day-hint.js";
import weekPlan from "../modules/nutrition/week-plan.js";
import backupUpload from "../modules/nutrition/backup-upload.js";
import backupDownload from "../modules/nutrition/backup-download.js";
import dayPlan from "../modules/nutrition/day-plan.js";
import shoppingList from "../modules/nutrition/shopping-list.js";

/**
 * Broad best-effort лімітер для всіх nutrition-endpoint-ів; детальні per-key
 * ліміти лишаються всередині окремих handler-ів (буде підчищено у PR 4).
 */
export function createNutritionRouter() {
  const r = Router();
  r.use(
    "/api/nutrition",
    rateLimitExpress({ key: "api:nutrition", limit: 120, windowMs: 60_000 }),
  );
  r.all("/api/nutrition/analyze-photo", asyncHandler(analyzePhoto));
  r.all("/api/nutrition/parse-pantry", asyncHandler(parsePantry));
  r.all("/api/nutrition/refine-photo", asyncHandler(refinePhoto));
  r.all("/api/nutrition/recommend-recipes", asyncHandler(recommendRecipes));
  r.all("/api/nutrition/day-hint", asyncHandler(dayHint));
  r.all("/api/nutrition/week-plan", asyncHandler(weekPlan));
  r.all("/api/nutrition/backup-upload", asyncHandler(backupUpload));
  r.all("/api/nutrition/backup-download", asyncHandler(backupDownload));
  r.all("/api/nutrition/day-plan", asyncHandler(dayPlan));
  r.all("/api/nutrition/shopping-list", asyncHandler(shoppingList));
  return r;
}
