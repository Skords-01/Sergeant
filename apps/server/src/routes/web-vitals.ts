import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import webVitalsHandler from "../modules/web-vitals.js";

export function createWebVitalsRouter(): Router {
  const r = Router();
  r.post(
    "/api/metrics/web-vitals",
    rateLimitExpress({ key: "api:web-vitals", limit: 60, windowMs: 60_000 }),
    asyncHandler(webVitalsHandler),
  );
  return r;
}
