import { createAuthClient } from "better-auth/react";
import { apiUrl } from "@shared/lib/apiUrl.js";

function getAuthBaseURL(): string {
  const configured = apiUrl("");
  if (configured && configured !== "/" && configured.startsWith("http")) {
    return configured;
  }
  return window.location.origin;
}

// better-auth's inferred client type omits forget/reset password helpers,
// even though they are exposed at runtime via the standard email/password
// routes. Cast to a broader shape so we can expose them alongside the rest.
const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
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
export const {
  signIn,
  signUp,
  signOut,
  getSession,
  forgetPassword,
  resetPassword,
} = typedAuthClient;
