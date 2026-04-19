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

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  forgetPassword,
  resetPassword,
} = authClient;
