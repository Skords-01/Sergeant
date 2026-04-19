import { Router } from "express";
import {
  asyncHandler,
  rateLimitExpress,
  requireSession,
  setModule,
} from "../http/index.js";
import monoHandler from "../modules/mono.js";
import privatHandler from "../modules/privat.js";
import {
  bankMonoDelete,
  bankMonoPut,
  bankPrivatDelete,
  bankPrivatPut,
  bankStatus,
} from "../modules/bankVaultRoutes.js";

/**
 * Bank-proxy endpoints: Monobank та Privatbank. Обидва просто проксують до
 * API банку (з кешуванням/rate-limit-ом), тому логічно в одному routerі.
 *
 * `/api/mono` і `/api/privat` — легасі проксі. Credentials приймаються або
 * з `X-Token` / `X-Privat-*` заголовків (старий шлях), або діставаться
 * з server-side vault для залогіненого юзера. Див. `server/modules/mono.ts`.
 *
 * `/api/bank/*` — нові vault-endpoint-и для керування credentials
 * (зберегти, видалити, перевірити статус). Всі за `requireSession()`.
 */
export function createBanksRouter(): Router {
  const r = Router();
  r.use("/api/mono", setModule("finyk"));
  r.use("/api/privat", setModule("finyk"));
  r.use("/api/bank", setModule("finyk"));

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

  // Vault endpoints — всі потребують авторизації. Окремий rate-limit:
  // підключення банку — рідкісна дія, 10/хв більш ніж достатньо і
  // захищає від brute-force через перепідключення.
  r.use(
    "/api/bank",
    rateLimitExpress({ key: "api:bank", limit: 10, windowMs: 60_000 }),
  );
  r.use("/api/bank", requireSession());
  r.get("/api/bank/status", asyncHandler(bankStatus));
  r.post("/api/bank/mono/token", asyncHandler(bankMonoPut));
  r.delete("/api/bank/mono/token", asyncHandler(bankMonoDelete));
  r.post("/api/bank/privat/credentials", asyncHandler(bankPrivatPut));
  r.delete("/api/bank/privat/credentials", asyncHandler(bankPrivatDelete));

  return r;
}
