import { getSessionUser } from "../auth.js";

/**
 * Router-level auth-middleware. Резолвить Better Auth сесію, кладе юзера в
 * `req.user` і кличе `next()`. Якщо сесії немає — 401; якщо lookup впав
 * (наприклад, тимчасовий недоступ БД) — передаємо помилку далі у error-
 * handler (500), бо для звичайних endpoint-ів фронту важливо відрізняти
 * "ти не залогінений" від "у нас щас все горить".
 *
 * Для endpoint-ів, де фронт історично трактує будь-яку невдачу auth як
 * "не залогінений" (push subscribe/unsubscribe — сервіс-воркер не має
 * падати у 500 при тимчасовому збої), використовуй `requireSessionSoft()`.
 *
 * @returns {import("express").RequestHandler}
 */
export function requireSession() {
  return async (req, res, next) => {
    try {
      const user = await getSessionUser(req);
      if (!user) {
        return res
          .status(401)
          .json({ error: "Потрібна автентифікація", code: "UNAUTHORIZED" });
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Як `requireSession()`, але ковтає будь-яку exception з `getSessionUser`
 * і мапить її у 401 замість 500. Потрібно для endpoint-ів, де фронт
 * обробляє "не залогінений" значно коректніше за "server error" —
 * насамперед push subscribe/unsubscribe, які смикає сервіс-воркер і де
 * історично був явний try/catch-to-401 у handler-і (pre-PR-4).
 *
 * @returns {import("express").RequestHandler}
 */
export function requireSessionSoft() {
  return async (req, res, next) => {
    let user = null;
    try {
      user = await getSessionUser(req);
    } catch {
      // swallow — transient auth/DB failure treated as "not logged in".
    }
    if (!user) {
      return res
        .status(401)
        .json({ error: "Потрібна автентифікація", code: "UNAUTHORIZED" });
    }
    req.user = user;
    next();
  };
}
