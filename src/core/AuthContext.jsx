import { createContext, useContext, useCallback, useState } from "react";
import { useSession, signIn, signUp, signOut } from "./authClient.js";

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
    } catch {
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, authError, setAuthError, login, register, logout }}
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
