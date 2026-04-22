import { createAuthClient } from "better-auth/react";
import { apiUrl } from "@shared/lib/apiUrl.js";
import {
  clearBearerToken,
  getBearerToken,
  setBearerToken,
} from "@shared/lib/bearerToken.js";
import { isCapacitor } from "@sergeant/shared";

function getAuthBaseURL(): string {
  const configured = apiUrl("");
  if (configured && configured !== "/" && configured.startsWith("http")) {
    return configured;
  }
  return window.location.origin;
}

/**
 * У Capacitor-оточенні cookie-сесія не тримається стабільно (Android cold
 * start, iOS ITP). Тому у shell вмикаємо bearer-гілку:
 *
 *   - `auth.token` — асинхронний провайдер, який читає токен з
 *     `@capacitor/preferences` (Keychain / EncryptedSharedPreferences).
 *     Better Auth підставить його у `Authorization: Bearer <token>` на
 *     кожен запит до `/api/auth/*`.
 *   - `onSuccess` — на відповідях від sign-in/sign-up сервер виставляє
 *     header `set-auth-token` (Better Auth `bearer()` плагін). Ловимо
 *     його і пишемо у сховище. Сервер також додає `set-auth-token` у
 *     `Access-Control-Expose-Headers`, тож крос-оріджн CORS його не
 *     ріже.
 *
 * У браузері `isCapacitor()` повертає `false`, провайдери ранньо
 * виходять, cookie-флов лишається недоторканим.
 */
const fetchOptions = {
  // `auth` у better-fetch — стандартизований шлях ставити Authorization.
  // `token` може бути sync або async; ми даємо async щоб попадати у
  // той самий dynamic-import chunk, що й API-клієнт (`shared/api`).
  auth: {
    type: "Bearer" as const,
    token: async (): Promise<string | undefined> => {
      if (!isCapacitor()) return undefined;
      const token = await getBearerToken();
      return token ?? undefined;
    },
  },
  onSuccess: async (ctx: { response: Response }) => {
    if (!isCapacitor()) return;
    const token = ctx.response.headers.get("set-auth-token");
    if (token) {
      await setBearerToken(token);
    }
  },
};

const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  fetchOptions,
}) as ReturnType<typeof createAuthClient> & {
  forgetPassword: (args: {
    email: string;
    redirectTo?: string;
  }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
  resetPassword: (args: {
    token: string;
    newPassword: string;
  }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
};

type PasswordResetResult = {
  data?: unknown;
  error: {
    message?: string;
    status?: number;
    statusText?: string;
  } | null;
};

// The React auth-client's static TypeScript surface doesn't advertise
// `forgetPassword` / `resetPassword` — Better Auth resolves them at runtime via
// a Proxy over the email/password plugin endpoints. We extend the type here so
// consumers can keep destructuring them; runtime behaviour is unchanged.
const typedAuthClient = authClient as typeof authClient & {
  forgetPassword: (args: {
    email: string;
    redirectTo?: string;
  }) => Promise<PasswordResetResult>;
  resetPassword: (args: {
    newPassword: string;
    token?: string;
  }) => Promise<PasswordResetResult>;
};

// NOTE: `useSession` is intentionally NOT re-exported here. The single
// source of truth for "who am I" lives in `AuthContext`, which drives off
// `useUser()` from `@sergeant/api-client/react` (→ `GET /api/v1/me`). Better
// Auth survives only as the actions layer (sign-in / sign-up / sign-out /
// password reset). If you need a one-off session check outside React (e.g.
// service worker, Playwright helper), import `getSession` below.
const {
  signIn,
  signUp,
  signOut: rawSignOut,
  getSession,
  forgetPassword,
  resetPassword,
} = typedAuthClient;

type SignOutFn = typeof rawSignOut;

/**
 * Обгортка над `signOut`, що додатково витирає bearer-токен зі сховища
 * shell-а. Сервер при sign-out інвалідує сесію у БД, але токен у
 * Keychain/SharedPreferences треба прибрати самим — інакше наступний
 * cold start спробує пристосувати протухлий `Authorization` і полетить у
 * 401 ще до того, як юзер побачить sign-in. Поза Capacitor це no-op.
 */
const signOut: SignOutFn = (async (...args) => {
  try {
    return await rawSignOut(...args);
  } finally {
    if (isCapacitor()) {
      await clearBearerToken();
    }
  }
}) as SignOutFn;

export { signIn, signUp, signOut, getSession, forgetPassword, resetPassword };
