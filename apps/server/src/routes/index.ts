import type { Express } from "express";
import type { Pool } from "pg";
import { createAuthRouter } from "./auth.js";
import { createBanksRouter } from "./banks.js";
import { createBarcodeRouter } from "./barcode.js";
import { createChatRouter } from "./chat.js";
import { createCoachRouter } from "./coach.js";
import { createFoodSearchRouter } from "./food-search.js";
import { createHealthRouter } from "./health.js";
import { createNutritionRouter } from "./nutrition.js";
import { createPushRouter } from "./push.js";
import { createSyncRouter } from "./sync.js";
import { createWebVitalsRouter } from "./web-vitals.js";
import { createWeeklyDigestRouter } from "./weekly-digest.js";

/**
 * Реєструє всі доменні роутери на переданому Express-додатку. Кожен роутер
 * мапить повний шлях (`/api/...`) і мoнтується без префіксу, щоб `req.url`
 * лишався ідентичним тому, що бачили handler-и до рефактору — це гарантує
 * нуль поведінкових змін.
 *
 * Порядок реєстрації відповідає тому, що був inline у `server/app.js`: спочатку
 * health/metrics, потім auth (перед глобальним CORS на /api — див. коментар у
 * `app.js`), потім решта доменних роутерів.
 */
export function registerRoutes(app: Express, { pool }: { pool: Pool }): void {
  app.use(createHealthRouter({ pool }));
  app.use(createAuthRouter());
  app.use(createSyncRouter());
  app.use(createChatRouter());
  app.use(createBanksRouter());
  app.use(createBarcodeRouter());
  app.use(createNutritionRouter());
  app.use(createWeeklyDigestRouter());
  app.use(createCoachRouter());
  app.use(createFoodSearchRouter());
  app.use(createWebVitalsRouter());
  app.use(createPushRouter());
}
