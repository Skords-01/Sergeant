import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import foodSearchHandler from "../modules/food-search.js";

export function createFoodSearchRouter() {
  const r = Router();
  r.get(
    "/api/food-search",
    rateLimitExpress({ key: "api:food-search", limit: 40, windowMs: 60_000 }),
    asyncHandler(foodSearchHandler),
  );
  return r;
}
