import { Router } from "express";
import {
  asyncHandler,
  rateLimitExpress,
  requireApiSecret,
  requireSessionSoft,
  setModule,
} from "../http/index.js";
import {
  sendPush,
  subscribe as pushSubscribe,
  unsubscribe as pushUnsubscribe,
  vapidPublic,
} from "../modules/push.js";

/**
 * `/api/push/vapid-public` свідомо поза rate-limiter-ом: його смикає фронт
 * під час реєстрації сервіс-воркера і він має бути швидким/дешевим. Решта
 * endpoint-ів (subscribe/unsubscribe/send) лімітуються.
 *
 * subscribe/unsubscribe використовують `requireSessionSoft`, а не
 * `requireSession`: service worker смикає ці endpoint-и у фоні, і
 * історично handler трактував будь-яку невдачу `getSessionUser` як 401
 * (а не 500), щоб тимчасовий збій БД не перетворювався на notification
 * "server error" на фронті. `send` — внутрішній API cron/worker-ів,
 * захищений `X-Api-Secret`.
 */
export function createPushRouter(): Router {
  const r = Router();
  r.use("/api/push", setModule("push"));
  r.get("/api/push/vapid-public", asyncHandler(vapidPublic));
  r.use(
    "/api/push",
    rateLimitExpress({ key: "api:push", limit: 30, windowMs: 60_000 }),
  );
  r.post(
    "/api/push/subscribe",
    requireSessionSoft(),
    asyncHandler(pushSubscribe),
  );
  r.delete(
    "/api/push/subscribe",
    requireSessionSoft(),
    asyncHandler(pushUnsubscribe),
  );
  r.post(
    "/api/push/send",
    requireApiSecret("API_SECRET"),
    asyncHandler(sendPush),
  );
  return r;
}
