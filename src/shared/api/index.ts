export { ApiError, isApiError } from "./ApiError";
export type { ApiErrorKind, ApiErrorInit } from "./ApiError";
export { http, request } from "./httpClient";
export type {
  HttpMethod,
  ParseMode,
  QueryValue,
  RequestOptions,
} from "./types";

export { syncApi } from "./endpoints/sync";
export type { PushAllResult, PullAllResult } from "./endpoints/sync";
export { coachApi } from "./endpoints/coach";
export type { CoachInsightPayload } from "./endpoints/coach";
export { chatApi } from "./endpoints/chat";
export type { ChatRequestPayload, ChatResponse } from "./endpoints/chat";
export { weeklyDigestApi } from "./endpoints/weeklyDigest";
export type { WeeklyDigestPayload } from "./endpoints/weeklyDigest";
export { pushApi } from "./endpoints/push";
export { nutritionApi } from "./endpoints/nutrition";
export type {
  NutritionMacros,
  NutritionPhotoPortion,
  NutritionPhotoIngredient,
  NutritionPhotoResult,
  NutritionPhotoResponse,
  NutritionRecipe,
  NutritionRecipesResponse,
  NutritionWeekDay,
  NutritionWeekPlan,
  NutritionWeekPlanResponse,
  NutritionMealType,
  NutritionDayMeal,
  NutritionDayPlan,
  NutritionDayPlanResponse,
  NutritionDayHintResponse,
  NutritionShoppingItem,
  NutritionShoppingCategory,
  NutritionShoppingListResponse,
  NutritionPantryItem,
  NutritionParsePantryResponse,
  NutritionBackupUploadResponse,
  NutritionBackupDownloadResponse,
} from "./endpoints/nutrition";
export { barcodeApi } from "./endpoints/barcode";
export { foodSearchApi } from "./endpoints/foodSearch";
export { monoApi } from "./endpoints/mono";
export type {
  MonoAccount,
  MonoJar,
  MonoClientInfo,
  MonoStatementEntry,
  MonoCashbackType,
} from "./endpoints/mono";
export { privatApi } from "./endpoints/privat";
export type {
  PrivatCredentials,
  PrivatBalanceRecord,
  PrivatBalanceFinalResponse,
  PrivatStatementEntry,
  PrivatStatementsResponse,
} from "./endpoints/privat";
