import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import {
  syncPull,
  syncPullAll,
  syncPush,
  syncPushAll,
} from "../modules/sync.js";

export function createSyncRouter() {
  const r = Router();
  r.use(
    "/api/sync",
    rateLimitExpress({ key: "api:sync", limit: 30, windowMs: 60_000 }),
  );
  r.all("/api/sync/push", asyncHandler(syncPush));
  r.all("/api/sync/pull", asyncHandler(syncPull));
  r.all("/api/sync/pull-all", asyncHandler(syncPullAll));
  r.all("/api/sync/push-all", asyncHandler(syncPushAll));
  return r;
}
