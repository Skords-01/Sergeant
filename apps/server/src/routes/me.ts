import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler, requireSession, setModule } from "../http/index.js";

type AuthedUser = {
  id: string;
  email?: string;
  name?: string;
  image?: string | null;
  emailVerified?: boolean;
};

/**
 * `/api/me` — уніфікований endpoint "хто я" для web cookie-сесій та
 * mobile bearer-токенів.
 *
 * Реалізація навмисно банальна: `requireSession()` делегує резолюцію
 * сесії у `getSessionUser()` → `auth.api.getSession(headers)`. Better Auth
 * bearer-плагін підхоплює `Authorization: Bearer <token>` ДО виклику
 * cookie-парсера, перекладає його у in-memory cookie і далі код не
 * розрізняє канал. Тому один роут працює для обох клієнтів.
 *
 * Доступний і на `/api/me`, і на `/api/v1/me` (див. `apiVersionRewrite`
 * у `server/app.ts`). Формат відповіді сумісний із `auth.api.getSession`,
 * але обрізаний до публічних полів — не повертаємо internal timestamps
 * чи id сесії.
 */
export function createMeRouter(): Router {
  const r = Router();
  r.use("/api/me", setModule("me"));
  r.get(
    "/api/me",
    requireSession(),
    asyncHandler(async (req: Request, res: Response) => {
      const user = (req as Request & { user: AuthedUser }).user;
      res.json({
        user: {
          id: user.id,
          email: user.email ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
          emailVerified: Boolean(user.emailVerified),
        },
      });
    }),
  );
  return r;
}
