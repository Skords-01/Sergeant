import {
  nutritionApi,
  isApiError,
  type NutritionPhotoResponse,
  type NutritionRecipesResponse,
  type NutritionWeekPlanResponse,
  type NutritionDayPlanResponse,
  type NutritionDayHintResponse,
  type NutritionShoppingListResponse,
  type NutritionParsePantryResponse,
  type NutritionBackupUploadResponse,
  type NutritionBackupDownloadResponse,
} from "@shared/api";
import { friendlyApiError } from "./nutritionErrors.js";

/**
 * Тонкий адаптер над централізованим `nutritionApi`. Переводить
 * `ApiError` з `@shared/api` у юзер-френдлі `new Error(message)` —
 * старий контракт, якого очікують nutrition-хуки.
 *
 * Generic-параметр `T` пробрасує типізовану відповідь із
 * `@shared/api/endpoints/nutrition` у споживача (наприклад,
 * `useMutation<TData>`), коли викликати як `postJson<TResponse>(...)`.
 * Типізовані helper-и нижче (`recommendRecipes`, `parsePantry`, …)
 * роблять це автоматично — вони кращий вибір для нового коду.
 */
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  try {
    return await nutritionApi.postJson<T>(url, body);
  } catch (err) {
    if (!isApiError(err)) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Не вдалося зʼєднатися із сервером.";
      throw new Error(message);
    }
    if (err.kind === "network") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("Немає підключення до інтернету. Спробуй пізніше.");
      }
      throw new Error(err.message || "Не вдалося зʼєднатися із сервером.");
    }
    if (err.kind === "parse") {
      // Частий кейс на Vercel: /api/* перехоплено rewrite і повернувся index.html
      if (/<!doctype html/i.test(err.bodyText || "")) {
        throw new Error(
          "API повернув HTML замість JSON (ймовірно, rewrite перехоплює /api/*).",
        );
      }
      throw new Error(err.bodyText || "Некоректна відповідь сервера");
    }
    // kind === "http" або "aborted"
    throw new Error(friendlyApiError(err.status, err.serverMessage));
  }
}

export const analyzePhoto = (body: unknown) =>
  postJson<NutritionPhotoResponse>("/api/nutrition/analyze-photo", body);

export const refinePhoto = (body: unknown) =>
  postJson<NutritionPhotoResponse>("/api/nutrition/refine-photo", body);

export const recommendRecipes = (body: unknown) =>
  postJson<NutritionRecipesResponse>("/api/nutrition/recommend-recipes", body);

export const fetchWeekPlan = (body: unknown) =>
  postJson<NutritionWeekPlanResponse>("/api/nutrition/week-plan", body);

export const fetchDayPlan = (body: unknown) =>
  postJson<NutritionDayPlanResponse>("/api/nutrition/day-plan", body);

export const fetchDayHint = (body: unknown) =>
  postJson<NutritionDayHintResponse>("/api/nutrition/day-hint", body);

export const fetchShoppingList = (body: unknown) =>
  postJson<NutritionShoppingListResponse>("/api/nutrition/shopping-list", body);

export const parsePantry = (body: unknown) =>
  postJson<NutritionParsePantryResponse>("/api/nutrition/parse-pantry", body);

export const backupUpload = (body: { blob: unknown }) =>
  postJson<NutritionBackupUploadResponse>("/api/nutrition/backup-upload", body);

export const backupDownload = () =>
  postJson<NutritionBackupDownloadResponse>(
    "/api/nutrition/backup-download",
    {},
  );
