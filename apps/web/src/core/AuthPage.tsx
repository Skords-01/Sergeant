import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useAuth } from "./AuthContext.jsx";

export function AuthPage({ onContinueWithoutAccount }) {
  const { login, register, requestPasswordReset, authError, setAuthError } =
    useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  // "idle" → the panel renders the reset form; "sending" disables the
  // button while the request flies; "sent" replaces the form with a
  // neutral confirmation (no enumeration hints) so the user knows to
  // check their inbox.
  const [forgotState, setForgotState] = useState("idle");
  const [forgotEmail, setForgotEmail] = useState("");

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setAuthError(null);
    setShowForgot(false);
    setForgotState("idle");
    setForgotEmail("");
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const target = (forgotEmail || email || "").trim();
    if (!target) {
      setAuthError("Введіть email, на який відправити лист.");
      return;
    }
    setForgotState("sending");
    const ok = await requestPasswordReset(target);
    setForgotState(ok ? "sent" : "idle");
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
              <Input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-muted"
              >
                Пароль
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setForgotState("idle");
                    setForgotEmail((cur) => cur || email || "");
                    setShowForgot((v) => !v);
                  }}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 rounded"
                >
                  Забули пароль?
                </button>
              )}
            </div>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Мінімум 6 символів"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {showForgot && (
            <div
              role="group"
              aria-label="Скидання пароля"
              className="text-xs text-text bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-3 leading-relaxed space-y-2"
            >
              {forgotState === "sent" ? (
                <p>
                  Якщо такий email зареєстровано — ми відправили лист із
                  посиланням для скидання пароля. Перевір вхідні та папку
                  «Спам». Локальні дані на пристрої залишаються без змін.
                </p>
              ) : (
                <>
                  <p>
                    Введи email акаунту — пришлемо посилання для скидання
                    пароля. Локальні дані на пристрої залишаються без змін.
                  </p>
                  <label
                    htmlFor="auth-forgot-email"
                    className="block text-xs font-medium text-muted"
                  >
                    Email для скидання
                  </label>
                  <Input
                    id="auth-forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="email@example.com"
                    autoComplete="email"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    loading={forgotState === "sending"}
                    onClick={handleForgotSubmit}
                    className="w-full"
                  >
                    {forgotState === "sending" ? "Надсилаю…" : "Надіслати лист"}
                  </Button>
                </>
              )}
            </div>
          )}

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
              ? "Зачекайте…"
              : mode === "login"
                ? "Увійти"
                : "Зареєструватися"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={switchMode}
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline px-2 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
          >
            {mode === "login"
              ? "Немає акаунту? Зареєструватися"
              : "Вже є акаунт? Увійти"}
          </button>
        </div>

        {typeof onContinueWithoutAccount === "function" && (
          <>
            {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift --
                Inline "або" divider between two <span> rules — structurally
                a delimiter, not a heading, so SectionHeading is the wrong
                abstraction. */}
            <div className="my-6 flex items-center gap-3 text-xs text-muted uppercase tracking-wider">
              <span className="flex-1 h-px bg-line" />
              або
              <span className="flex-1 h-px bg-line" />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onContinueWithoutAccount}
            >
              Продовжити без акаунту
            </Button>
            <p className="mt-2 text-center text-xs text-subtle leading-relaxed">
              Все працює локально. Акаунт потрібен лише для синхронізації між
              пристроями.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
