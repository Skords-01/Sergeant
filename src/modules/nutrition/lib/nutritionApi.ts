import {
  nutritionApi,
  isApiError,
  ApiError,
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
 * Тонкий адаптер над централізованим `nutritionApi`. Переписує `message`
 * у `ApiError` на юзер-френдлі текст (той, що очікують nutrition-хуки
 * і показують у банері помилки), але зберігає `kind` / `status` / `body`
 * — щоб React Query міг коректно ретраїти (`isRetriableError` читає
 * `.status`) і щоб консьюмери могли розрізняти `isOffline` / `isAuth`
 * через `isApiError`.
 *
 * Generic-параметр `T` пробрасує типізовану відповідь із
 * `@shared/api/endpoints/nutrition` у споживача (наприклад,
 * `useMutation<TData>`), коли викликати як `postJson<TResponse>(...)`.
 * Типізовані helper-и нижче (`recommendRecipes`, `parsePantry`, …)
 * роблять це автоматично — вони кращий вибір для нового коду.
 */
function friendlyNutritionMessage(err: ApiError): string {
  if (err.kind === "network") {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Немає підключення до інтернету. Спробуй пізніше.";
    }
    return err.message || "Не вдалося зʼєднатися із сервером.";
  }
  if (err.kind === "parse") {
    // Частий кейс на Vercel: /api/* перехоплено rewrite і повернувся index.html
    if (/<!doctype html/i.test(err.bodyText || "")) {
      return "API повернув HTML замість JSON (ймовірно, rewrite перехоплює /api/*).";
    }
    return err.bodyText || "Некоректна відповідь сервера";
  }
  // kind === "http" або "aborted"
  return friendlyApiError(err.status, err.serverMessage);
}

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
      // Обгортаємо невідому помилку у ApiError(kind:"network"), щоб
      // подальший onError не мусив розрізняти "шар API" і "все інше".
      throw new ApiError({
        kind: "network",
        message,
        url,
        cause: err,
      });
    }
    throw new ApiError({
      kind: err.kind,
      message: friendlyNutritionMessage(err),
      status: err.status,
      body: err.body,
      bodyText: err.bodyText,
      url: err.url,
      cause: err,
    });
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
