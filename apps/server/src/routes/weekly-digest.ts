import { Router } from "express";
import {
  asyncHandler,
  rateLimitExpress,
  requireAiQuota,
  requireAnthropicKey,
  setModule,
} from "../http/index.js";
import weeklyDigest from "../modules/weekly-digest.js";

export function createWeeklyDigestRouter(): Router {
  const r = Router();
  r.post(
    "/api/weekly-digest",
    setModule("weekly-digest"),
    rateLimitExpress({
      key: "api:weekly-digest",
      limit: 10,
      windowMs: 60 * 60_000,
    }),
    requireAnthropicKey(),
    requireAiQuota(),
    asyncHandler(weeklyDigest),
  );
  return r;
}
