import { Router } from "express";
import { asyncHandler, rateLimitExpress, setModule } from "../http/index.js";
import monoHandler from "../modules/mono.js";
import privatHandler from "../modules/privat.js";

/**
 * Bank-proxy endpoints: Monobank та Privatbank. Обидва просто проксують до
 * API банку (з кешуванням/rate-limit-ом), тому логічно в одному routerі.
 *
 * Token-перевірка (`x-token` / `x-privat-id`+`x-privat-token`) зроблена
 * всередині handler-а: це не сесійна auth, а upstream API-credentials, які
 * і так треба прочитати з заголовка, щоб передати далі в `fetch(...)`. Тому
 * middleware тут тільки тегує домен і rate-limit-ить.
 */
export function createBanksRouter(): Router {
  const r = Router();
  r.use("/api/mono", setModule("finyk"));
  r.use("/api/privat", setModule("finyk"));
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
