import { createContext, useContext, useCallback, useState } from "react";
import {
  useSession,
  signIn,
  signUp,
  signOut,
  forgetPassword,
} from "./authClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const sessionQuery = useSession();
  const user = sessionQuery?.data?.user ?? null;
  const isLoading = sessionQuery?.isPending ?? false;

  const [authError, setAuthError] = useState(null);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      const result = await signIn.email({ email, password });
      if (result?.error) {
        setAuthError(result.error.message || "Помилка входу");
        return false;
      }
      return true;
    } catch (err) {
      setAuthError(err?.message || "Помилка входу");
      return false;
    }
  }, []);

  const register = useCallback(async (email, password, name) => {
    setAuthError(null);
    try {
      const result = await signUp.email({ email, password, name });
      if (result?.error) {
        setAuthError(result.error.message || "Помилка реєстрації");
        return false;
      }
      return true;
    } catch (err) {
      setAuthError(err?.message || "Помилка реєстрації");
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch {}
  }, []);

  // Request a password reset email via Better Auth. Returns `true` when
  // the request was accepted (the server still answers OK even if the
  // address isn't registered — we don't leak account enumeration). The
  // UI uses that flag to show a neutral "check your inbox" state.
  const requestPasswordReset = useCallback(async (email) => {
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
      setAuthError(err?.message || "Не вдалося надіслати лист для скидання.");
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
