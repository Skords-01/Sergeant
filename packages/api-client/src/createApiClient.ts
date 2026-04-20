import {
  createHttpClient,
  type HttpClient,
  type HttpClientConfig,
} from "./httpClient";
import { createSyncEndpoints, type SyncEndpoints } from "./endpoints/sync";
import { createCoachEndpoints, type CoachEndpoints } from "./endpoints/coach";
import { createChatEndpoints, type ChatEndpoints } from "./endpoints/chat";
import { createPushEndpoints, type PushEndpoints } from "./endpoints/push";
import {
  createNutritionEndpoints,
  type NutritionEndpoints,
  type NutritionTokenProvider,
} from "./endpoints/nutrition";
import {
  createBarcodeEndpoints,
  type BarcodeEndpoints,
} from "./endpoints/barcode";
import {
  createFoodSearchEndpoints,
  type FoodSearchEndpoints,
} from "./endpoints/foodSearch";
import { createMonoEndpoints, type MonoEndpoints } from "./endpoints/mono";
import {
  createPrivatEndpoints,
  type PrivatEndpoints,
} from "./endpoints/privat";
import {
  createWeeklyDigestEndpoints,
  type WeeklyDigestEndpoints,
} from "./endpoints/weeklyDigest";

export interface ApiClientConfig extends HttpClientConfig {
  /**
   * Провайдер токена для nutrition-ендпоінтів (прокидується у заголовок
   * `X-Token`). Використовується тільки для `/api/nutrition/*`.
   */
  getNutritionToken?: NutritionTokenProvider;
}

/**
 * Типізований API-клієнт для всіх публічних ендпоінтів Sergeant. Повертає
 * об'єкт з `http` (низькорівневі методи) та набором модульних ендпоінтів
 * (`sync`, `coach`, `chat`, `push`, `nutrition`, `barcode`, `foodSearch`,
 * `mono`, `privat`, `weeklyDigest`).
 *
 * Веб-додаток створює один інстанс на старті (див.
 * `apps/web/src/shared/api/client.ts`). RN-додаток зможе створити свій
 * інстанс з іншим `baseUrl` та `getToken`, що читає токен зі сховища.
 */
export interface ApiClient {
  http: HttpClient;
  sync: SyncEndpoints;
  coach: CoachEndpoints;
  chat: ChatEndpoints;
  push: PushEndpoints;
  nutrition: NutritionEndpoints;
  barcode: BarcodeEndpoints;
  foodSearch: FoodSearchEndpoints;
  mono: MonoEndpoints;
  privat: PrivatEndpoints;
  weeklyDigest: WeeklyDigestEndpoints;
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const { getNutritionToken, ...httpConfig } = config;
  const http = createHttpClient(httpConfig);
  return {
    http,
    sync: createSyncEndpoints(http),
    coach: createCoachEndpoints(http),
    chat: createChatEndpoints(http),
    push: createPushEndpoints(http),
    nutrition: createNutritionEndpoints(http, { getToken: getNutritionToken }),
    barcode: createBarcodeEndpoints(http),
    foodSearch: createFoodSearchEndpoints(http),
    mono: createMonoEndpoints(http),
    privat: createPrivatEndpoints(http),
    weeklyDigest: createWeeklyDigestEndpoints(http),
  };
}
