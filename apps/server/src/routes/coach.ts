import { Router } from "express";
import {
  asyncHandler,
  rateLimitExpress,
  requireAiQuota,
  requireAnthropicKey,
  requireSession,
  setModule,
} from "../http/index.js";
import {
  coachInsight,
  coachMemoryGet,
  coachMemoryPost,
} from "../modules/coach.js";

/**
 * `/api/coach/*` — розведено на окремі route-и з точним HTTP-методом і своїм
 * ланцюгом middleware:
 *   - `GET/POST /memory` — читання/запис пам'яті; тільки session.
 *   - `POST /insight`   — генерація пораду через Anthropic; session + ключ + квота.
 */
export function createCoachRouter(): Router {
  const r = Router();
  r.use("/api/coach", setModule("coach"));
  r.use(
    "/api/coach",
    rateLimitExpress({ key: "api:coach", limit: 20, windowMs: 60 * 60_000 }),
  );
  r.get("/api/coach/memory", requireSession(), asyncHandler(coachMemoryGet));
  r.post("/api/coach/memory", requireSession(), asyncHandler(coachMemoryPost));
  r.post(
    "/api/coach/insight",
    requireSession(),
    requireAnthropicKey(),
    requireAiQuota(),
    asyncHandler(coachInsight),
  );
  return r;
}
