import { createAuthClient } from "better-auth/react";
import { apiUrl } from "@shared/lib/apiUrl.js";

function getAuthBaseURL() {
  const configured = apiUrl("");
  if (configured && configured !== "/" && configured.startsWith("http")) {
    return configured;
  }
  return window.location.origin;
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
} = authClient;
