import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import monoHandler from "../modules/mono.js";
import privatHandler from "../modules/privat.js";

/**
 * Bank-proxy endpoints: Monobank та Privatbank. Обидва просто проксують до
 * API банку (з кешуванням/rate-limit-ом), тому логічно в одному routerі.
 */
export function createBanksRouter() {
  const r = Router();
  r.all(
    "/api/mono",
    rateLimitExpress({ key: "api:mono", limit: 60, windowMs: 60_000 }),
    asyncHandler(monoHandler),
  );
  r.all(
    "/api/privat",
    rateLimitExpress({ key: "api:privat", limit: 30, windowMs: 60_000 }),
    asyncHandler(privatHandler),
  );
  return r;
}
