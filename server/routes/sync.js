import { Router } from "express";
import {
  asyncHandler,
  rateLimitExpress,
  requireSession,
  setModule,
} from "../http/index.js";
import {
  syncPull,
  syncPullAll,
  syncPush,
  syncPushAll,
} from "../modules/sync.js";

/**
 * `/api/sync/*` — всі операції потребують авторизованої сесії. `setModule` і
 * `requireSession` унесені з handler-ів сюди: handler тепер просто читає
 * `req.user` і виконує бізнес-логіку.
 */
export function createSyncRouter() {
  const r = Router();
  r.use("/api/sync", setModule("sync"));
  r.use(
    "/api/sync",
    rateLimitExpress({ key: "api:sync", limit: 30, windowMs: 60_000 }),
  );
  r.use("/api/sync", requireSession());
  r.post("/api/sync/push", asyncHandler(syncPush));
  r.post("/api/sync/pull", asyncHandler(syncPull));
  r.get("/api/sync/pull-all", asyncHandler(syncPullAll));
  r.post("/api/sync/pull-all", asyncHandler(syncPullAll));
  r.post("/api/sync/push-all", asyncHandler(syncPushAll));
  return r;
}
