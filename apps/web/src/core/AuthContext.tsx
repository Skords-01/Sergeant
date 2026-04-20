import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser, apiQueryKeys } from "@sergeant/api-client/react";
import type { User } from "@sergeant/shared";
import { signIn, signUp, signOut, forgetPassword } from "./authClient.js";

/**
 * AuthContext — єдине джерело правди «хто я» для веб-додатку.
 *
 * Дані про поточного користувача тягнемо через `useUser()` з
 * `@sergeant/api-client/react` (`GET /api/v1/me` + runtime-валідація
 * `MeResponseSchema`). Better Auth лишається тільки як actions-layer
 * (`signIn.email`, `signUp.email`, `signOut`, `forgetPassword`) — після
 * кожної дії інвалідуємо `apiQueryKeys.me.current()`, щоб наступний
 * рендер побачив свіжий профіль.
 */

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  status: AuthStatus;
  authError: string | null;
  setAuthError: (msg: string | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const meQuery = useUser({
    // 401 від `/api/v1/me` для анонімного візитера — нормальний стан,
    // а не «справжня» помилка: ми лишаємо `user = null` і рендеримо
    // sign-in surface. Тому не ретраїмо і не завалюємо UI спінером.
    retry: false,
  });

  const user = meQuery.data?.user ?? null;
  const isLoading = meQuery.isLoading;
  const status: AuthStatus = isLoading
    ? "loading"
    : user
      ? "authenticated"
      : "unauthenticated";

  const [authError, setAuthError] = useState<string | null>(null);

  const invalidateMe = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: apiQueryKeys.me.current() }),
    [queryClient],
  );

  const refresh = useCallback(async () => {
    await invalidateMe();
  }, [invalidateMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      try {
        const result = await signIn.email({ email, password });
        if (result?.error) {
          setAuthError(result.error.message || "Помилка входу");
          return false;
        }
        await invalidateMe();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Помилка входу";
        setAuthError(message);
        return false;
      }
    },
    [invalidateMe],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setAuthError(null);
      try {
        const result = await signUp.email({ email, password, name });
        if (result?.error) {
          setAuthError(result.error.message || "Помилка реєстрації");
          return false;
        }
        await invalidateMe();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Помилка реєстрації";
        setAuthError(message);
        return false;
      }
    },
    [invalidateMe],
  );

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Ігноруємо: навіть якщо Better Auth endpoint повернув помилку,
      // далі все одно викидаємо локальний me-кеш — UI має показати
      // sign-in surface, а не застрягти в «напів-залогіненому» стані.
    }
    await invalidateMe();
  }, [invalidateMe]);

  // Request a password reset email via Better Auth. Returns `true` when
  // the request was accepted (the server still answers OK even if the
  // address isn't registered — we don't leak account enumeration). The
  // UI uses that flag to show a neutral "check your inbox" state.
  const requestPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await forgetPassword({ email, redirectTo });
      if (result?.error) {
        setAuthError(
          result.error.message || "Не вдалося надіслати лист для скидання.",
        );
        return false;
      }
      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Не вдалося надіслати лист для скидання.";
      setAuthError(message);
      return false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      status,
      authError,
      setAuthError,
      login,
      register,
      logout,
      requestPasswordReset,
      refresh,
    }),
    [
      user,
      isLoading,
      status,
      authError,
      login,
      register,
      logout,
      requestPasswordReset,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
