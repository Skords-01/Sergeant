import { Router } from "express";
import { asyncHandler, rateLimitExpress, setModule } from "../http/index.js";
import foodSearchHandler from "../modules/food-search.js";

export function createFoodSearchRouter(): Router {
  const r = Router();
  r.get(
    "/api/food-search",
    setModule("nutrition"),
    rateLimitExpress({ key: "api:food-search", limit: 40, windowMs: 60_000 }),
    asyncHandler(foodSearchHandler),
  );
  return r;
}
