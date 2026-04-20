import type { Request, RequestHandler, Response } from "express";

/**
 * Guard для nutrition-endpoint-ів: якщо `NUTRITION_API_TOKEN` сконфігурований,
 * клієнт зобов'язаний передати `X-Token` з тим самим значенням, інакше 401.
 *
 * Якщо токен не заданий (локальний dev) — пропускаємо: це ручка для дешевого
 * захисту публічних AI-ендпоінтів у проді, а не повноцінна auth-схема.
 *
 * Історично жив у `server/modules/nutrition/lib/nutritionSecurity.js`; залишено
 * re-export там для зворотної сумісності — буде видалено у debolerplate-хвилі.
 */
export function requireNutritionTokenIfConfigured(
  req: Request,
  res: Response,
): boolean {
  const expected = process.env.NUTRITION_API_TOKEN;
  if (!expected) return true; // token не налаштований → нічого не ламаємо
  const got = req?.headers?.["x-token"];
  if (!got || String(got) !== String(expected)) {
    res.status(401).json({ error: "Токен відсутній або невірний" });
    return false;
  }
  return true;
}

/**
 * Express-middleware обгортка над `requireNutritionTokenIfConfigured`.
 * Використовується в router-chain, коли token-перевірка робиться на рівні
 * роутера, а не всередині handler-а.
 */
export function requireNutritionToken(): RequestHandler {
  return (req, res, next) => {
    if (!requireNutritionTokenIfConfigured(req, res)) return;
    next();
  };
}
