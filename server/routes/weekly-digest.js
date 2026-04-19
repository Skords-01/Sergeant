import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import weeklyDigest from "../modules/weekly-digest.js";

export function createWeeklyDigestRouter() {
  const r = Router();
  r.all(
    "/api/weekly-digest",
    rateLimitExpress({
      key: "api:weekly-digest",
      limit: 10,
      windowMs: 60 * 60_000,
    }),
    asyncHandler(weeklyDigest),
  );
  return r;
}
