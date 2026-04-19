import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import {
  sendPush,
  subscribe as pushSubscribe,
  unsubscribe as pushUnsubscribe,
  vapidPublic,
} from "../modules/push.js";

/**
 * `/api/push/vapid-public` свідомо поза rate-limiter-ом: його смикає фронт
 * під час регіс трації сервіс-воркера і він має бути швидким/дешевим. Решта
 * endpoint-ів (subscribe/unsubscribe/send) лімітуються.
 */
export function createPushRouter() {
  const r = Router();
  r.get("/api/push/vapid-public", asyncHandler(vapidPublic));
  r.use(
    "/api/push",
    rateLimitExpress({ key: "api:push", limit: 30, windowMs: 60_000 }),
  );
  r.post("/api/push/subscribe", asyncHandler(pushSubscribe));
  r.delete("/api/push/subscribe", asyncHandler(pushUnsubscribe));
  r.post("/api/push/send", asyncHandler(sendPush));
  return r;
}
