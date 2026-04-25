/**
 * `@shared/api` — легасі-бареl для веб-додатку.
 *
 * Усі реальні сутності живуть у пакеті `@sergeant/api-client`; тут ми лише
 * створюємо дефолтний інстанс `createApiClient(...)`, конфігуємо його під
 * Vite-середовище (baseUrl із `VITE_API_BASE_URL`, токен nutrition із
 * `VITE_NUTRITION_API_TOKEN`) і реекспортуємо окремі групи методів під
 * іменами, що вже використовуються по всьому `apps/web/src`.
 *
 * Для нового коду краще брати клієнт через `useApiClient()` з
 * `@sergeant/api-client/react` (DI через провайдер), але існуючі
 * імпорти `import { monoApi, pushApi, ... } from "@shared/api"` продовжують
 * працювати через цей файл.
 */
import { createApiClient } from "@sergeant/api-client";

import { apiUrl, getApiPrefix } from "@shared/lib/apiUrl";
import { getBearerToken } from "@shared/lib/bearerToken";

function readNutritionToken(): string {
  try {
    const token =
      typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_NUTRITION_API_TOKEN
        ? String(import.meta.env.VITE_NUTRITION_API_TOKEN)
        : "";
    return token;
  } catch {
    return "";
  }
}

export const apiClient = createApiClient({
  baseUrl: apiUrl(""),
  // `apiPrefix` синхронізує api-client із `apiUrl()` прямих `fetch`-викликів:
  // обидва канали шлють у `/api/v1/*` (default) або `/api/*` (VITE_API_VERSION=none).
  apiPrefix: getApiPrefix(),
  getNutritionToken: () => readNutritionToken(),
  // У Capacitor WebView cookie-сесія ненадійна (Android cold-start, iOS ITP),
  // тож шлемо `Authorization: Bearer <token>` — Better Auth `bearer()`
  // плагін резолвить його у сесію нарівно з cookie. У браузері
  // `getBearerToken()` повертає `null` і header не ставиться, cookie-флов
  // працює як раніше.
  getToken: () => getBearerToken(),
});

export const syncApi = apiClient.sync;
export const coachApi = apiClient.coach;
export const chatApi = apiClient.chat;
export const pushApi = apiClient.push;
export const nutritionApi = apiClient.nutrition;
export const barcodeApi = apiClient.barcode;
export const foodSearchApi = apiClient.foodSearch;
export const monoApi = apiClient.mono;
export const monoWebhookApi = apiClient.monoWebhook;
export const privatApi = apiClient.privat;
export const weeklyDigestApi = apiClient.weeklyDigest;

// Errors, types, HTTP primitives
export { ApiError, isApiError, createHttpClient } from "@sergeant/api-client";
export type {
  ApiClient,
  ApiClientConfig,
  ApiErrorInit,
  ApiErrorKind,
  BarcodeLookupResponse,
  BarcodeProduct,
  ChatCallOpts,
  ChatMessage,
  ChatRequestPayload,
  ChatResponse,
  CoachInsightPayload,
  FoodSearchProduct,
  FoodSearchResponse,
  HttpClient,
  HttpClientConfig,
  HttpMethod,
  ModulePullPayload,
  ModulePushPayload,
  ModulePushResult,
  MonoAccount,
  MonoCashbackType,
  MonoClientInfo,
  MonoAccountDto,
  MonoConnectionStatus,
  MonoJar,
  MonoStatementEntry,
  MonoSyncState,
  MonoTransactionDto,
  MonoTransactionsPage,
  MonoWebhookEndpoints,
  NutritionBackupDownloadResponse,
  NutritionBackupUploadResponse,
  NutritionDayHintResponse,
  NutritionDayMeal,
  NutritionDayPlan,
  NutritionDayPlanResponse,
  NutritionMacros,
  NutritionMealType,
  NutritionPantryItem,
  NutritionParsePantryResponse,
  NutritionPhotoIngredient,
  NutritionPhotoPortion,
  NutritionPhotoResponse,
  NutritionPhotoResult,
  NutritionRecipe,
  NutritionRecipesResponse,
  NutritionShoppingCategory,
  NutritionShoppingItem,
  NutritionShoppingListResponse,
  NutritionTokenProvider,
  NutritionWeekDay,
  NutritionWeekPlan,
  NutritionWeekPlanResponse,
  ParseMode,
  PrivatBalanceFinalResponse,
  PrivatBalanceRecord,
  PrivatCredentials,
  PrivatStatementEntry,
  PrivatStatementsResponse,
  PullAllResult,
  PushAllResult,
  QueryValue,
  RequestOptions,
  SyncEndpoints,
  TokenProvider,
  WeeklyDigestPayload,
  WeeklyDigestResponse,
} from "@sergeant/api-client";
