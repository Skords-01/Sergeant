import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@shared/components/ui/Button";
import { useToast } from "@shared/hooks/useToast";
import { BrandLogo } from "./app/BrandLogo";
import { resetPassword } from "./authClient";

/**
 * Landing page for the Better Auth password-reset magic link. The email
 * we send contains `<origin>/reset-password?token=...`; here we read the
 * token, let the user pick a new password, and call `resetPassword`.
 *
 * Kept intentionally minimal (no design system overlays or hub chrome)
 * so that even a user without local Sergeant data can land on this
 * route and recover their account.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const INPUT_CLS =
    "input-focus w-full min-h-[44px] px-4 py-3 rounded-xl bg-panel border border-line text-text text-[16px] md:text-sm placeholder:text-muted/50";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!token) {
      setStatus("error");
      setMessage(
        "Посилання неповне. Відкрий лист повністю або запроси новий скид пароля.",
      );
      return;
    }
    if (password.length < 10) {
      setStatus("error");
      setMessage("Пароль має бути мінімум 10 символів.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Паролі не збігаються.");
      return;
    }
    setStatus("sending");
    try {
      const result = await resetPassword({ token, newPassword: password });
      if (result?.error) {
        setStatus("error");
        setMessage(
          result.error.message ||
            "Не вдалося скинути пароль. Посилання могло вже бути використане.",
        );
        return;
      }
      setStatus("done");
      setMessage("Пароль оновлено. Зараз перенесу на вхід…");
      toast.success("Пароль оновлено");
      window.setTimeout(() => navigate("/sign-in", { replace: true }), 1500);
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Щось пішло не так. Спробуй ще раз.");
    }
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
          <BrandLogo as="h1" size="md" className="justify-center mb-1" />
          <p className="text-sm text-subtle">Новий пароль</p>
        </div>

        {!token ? (
          <div
            role="alert"
            className="text-sm text-text bg-error/10 border border-error/30 rounded-xl px-4 py-3 leading-relaxed space-y-3"
          >
            <p>
              Посилання на скидання пароля неповне або протерміноване. Відкрий
              останній лист повністю або запроси новий на сторінці входу.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => navigate("/sign-in", { replace: true })}
            >
              На сторінку входу
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reset-password-new"
                className="block text-xs font-medium text-muted mb-1.5"
              >
                Новий пароль
              </label>
              <input
                id="reset-password-new"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                className={INPUT_CLS}
                placeholder="Мінімум 10 символів"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label
                htmlFor="reset-password-confirm"
                className="block text-xs font-medium text-muted mb-1.5"
              >
                Підтвердження
              </label>
              <input
                id="reset-password-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={10}
                className={INPUT_CLS}
                placeholder="Введи пароль ще раз"
                autoComplete="new-password"
              />
            </div>

            {message && (
              <div
                role={status === "error" ? "alert" : "status"}
                className={
                  status === "error"
                    ? "text-xs text-error bg-error/10 border border-error/20 rounded-xl px-4 py-2.5"
                    : "text-xs text-text bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-2.5"
                }
              >
                {message}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={status === "sending"}
              className="w-full"
              disabled={status === "done"}
            >
              {status === "sending"
                ? "Зберігаю…"
                : status === "done"
                  ? "Готово"
                  : "Встановити новий пароль"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
