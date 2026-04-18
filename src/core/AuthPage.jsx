import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { useAuth } from "./AuthContext.jsx";

export function AuthPage() {
  const { login, register, authError, setAuthError } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setAuthError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "login") {
      await login(email, password);
    } else {
      await register(email, password, name || email.split("@")[0]);
    }
    setLoading(false);
  };

  const INPUT_CLS =
    "w-full min-h-[44px] px-4 py-3 rounded-xl bg-panel border border-line text-text text-[16px] md:text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors";

  return (
    <div
      className="min-h-dvh bg-bg flex flex-col items-center justify-center px-5"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text tracking-tight mb-1">
            Sergeant
          </h1>
          <p className="text-sm text-subtle">
            {mode === "login" ? "Вхід в акаунт" : "Створення акаунту"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-muted mb-1.5"
              >
                Ім{"'"}я
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLS}
                placeholder={"Ваше ім'я"}
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-muted mb-1.5"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={INPUT_CLS}
              placeholder="email@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-muted mb-1.5"
            >
              Пароль
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={INPUT_CLS}
              placeholder="Мінімум 6 символів"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {authError && (
            <div
              role="alert"
              className="text-xs text-error bg-error/10 border border-error/20 rounded-xl px-4 py-2.5"
            >
              {authError}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {loading
              ? "Зачекайте..."
              : mode === "login"
                ? "Увійти"
                : "Зареєструватися"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={switchMode}
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline px-2 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {mode === "login"
              ? "Немає акаунту? Зареєструватися"
              : "Вже є акаунт? Увійти"}
          </button>
        </div>
      </div>
    </div>
  );
}
