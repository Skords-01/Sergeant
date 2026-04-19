/**
 * Nutrition-специфічні security-утиліти.
 *
 * DEPRECATED: цей shim лишився після уніфікації. `checkRateLimit` і
 * `requireNutritionTokenIfConfigured` тепер живуть у `server/http/`. Файл буде
 * видалено у подальшому рефакторі (debolerplate wave) — нові хендлери мають
 * імпортувати напряму:
 *   import { checkRateLimit } from "../../../http/rateLimit.js";
 *   import { requireNutritionTokenIfConfigured } from "../../../http/requireNutritionToken.js";
 */
export { checkRateLimit } from "../../../http/rateLimit.js";
export { requireNutritionTokenIfConfigured } from "../../../http/requireNutritionToken.js";
