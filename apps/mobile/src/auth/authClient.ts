import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { getApiBaseURL } from "@/api/apiUrl";

/**
 * Better Auth Expo client.
 *
 * - `baseURL` — URL API-сервера (той самий, що для web). Беремо з
 *   `EXPO_PUBLIC_API_BASE_URL`, див. `src/api/apiUrl.ts`.
 * - `expoClient` — плагін, що:
 *     • серіалізує cookie-стейт у `expo-secure-store`;
 *     • автоматично прикладає `Authorization: Bearer <token>` на
 *       наступні запити після `sign-in/email` (див. `docs/mobile.md`);
 *     • підтримує redirect-и на `sergeant://` deep links.
 * - `scheme` має збігатися з `expo.scheme` у `app.json` (`sergeant`).
 */
const authClient = createAuthClient({
  baseURL: getApiBaseURL() || undefined,
  plugins: [
    expoClient({
      scheme: "sergeant",
      storagePrefix: "sergeant",
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut, getSession } = authClient;
export { authClient };
