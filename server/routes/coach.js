import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import coachHandler from "../modules/coach.js";

/**
 * `/api/coach/*` — поки той самий handler обробляє і `/memory`, і `/insight`,
 * розрізняючи по URL-суфіксу всередині. PR 5 розіб'є на два файли, а поки що
 * просто мапимо обидва шляхи на той самий export.
 */
export function createCoachRouter() {
  const r = Router();
  r.use(
    "/api/coach",
    rateLimitExpress({ key: "api:coach", limit: 20, windowMs: 60 * 60_000 }),
  );
  r.all("/api/coach/memory", asyncHandler(coachHandler));
  r.all("/api/coach/insight", asyncHandler(coachHandler));
  return r;
}
