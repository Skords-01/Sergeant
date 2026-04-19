import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { privatApi, isApiError } from "@shared/api";
import { safeReadLS } from "@shared/lib/storage";
import { hubKeys } from "@shared/lib/queryKeys";
import { useStorage as useFinykStorage } from "../../modules/finyk/hooks/useStorage.js";
import { getAccountLabel } from "../../modules/finyk/utils.js";
import {
  ConfirmModal,
  SettingsGroup,
  SettingsSubGroup,
} from "./SettingsPrimitives";

const PRIVAT_ENABLED = false;

type ConfirmKind = "cache" | "disconnect" | null;

interface CustomCategory {
  id: string;
  label: string;
}

interface UahAccount {
  id: string;
  currencyCode: number;
  balance: number;
  creditLimit?: number;
}

interface FinykInfoCache {
  info?: { name?: string; accounts?: UahAccount[] };
  name?: string;
  accounts?: UahAccount[];
}

interface FinykStorageShape {
  hiddenAccounts: string[];
  toggleHideAccount: (id: string) => void;
  customCategories: CustomCategory[];
  addCustomCategory: (label: string) => void;
  removeCustomCategory: (id: string) => void;
}

export function FinykSection() {
  const queryClient = useQueryClient();
  const {
    hiddenAccounts,
    toggleHideAccount,
    customCategories,
    addCustomCategory,
    removeCustomCategory,
  } = useFinykStorage({}) as FinykStorageShape;

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const [privatIdInput, setPrivatIdInput] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("finyk_privat_id") ||
        sessionStorage.getItem("finyk_privat_id") ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [privatTokenInput, setPrivatTokenInput] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("finyk_privat_token") ||
        sessionStorage.getItem("finyk_privat_token") ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [showPrivatToken, setShowPrivatToken] = useState(false);
  const [rememberPrivat, setRememberPrivat] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem("finyk_privat_id");
    } catch {
      return false;
    }
  });
  const [privatError, setPrivatError] = useState("");
  const [privatConnecting, setPrivatConnecting] = useState(false);
  const [privatConnected, setPrivatConnected] = useState<boolean>(() => {
    try {
      return !!(
        localStorage.getItem("finyk_privat_id") ||
        sessionStorage.getItem("finyk_privat_id")
      );
    } catch {
      return false;
    }
  });
  const [confirmDisconnectPrivat, setConfirmDisconnectPrivat] = useState(false);

  const connectPrivat = async () => {
    const cleanId = privatIdInput.trim();
    const cleanToken = privatTokenInput.trim();
    if (!cleanId || !cleanToken) {
      setPrivatError("Введіть Merchant ID та токен");
      return;
    }
    setPrivatConnecting(true);
    setPrivatError("");
    try {
      try {
        await privatApi.balanceFinal({
          merchantId: cleanId,
          merchantToken: cleanToken,
        });
      } catch (err) {
        if (isApiError(err) && err.kind === "http") {
          setPrivatError(err.serverMessage || `Помилка ${err.status}`);
          return;
        }
        throw err;
      }
      if (rememberPrivat) {
        localStorage.setItem("finyk_privat_id", cleanId);
        localStorage.setItem("finyk_privat_token", cleanToken);
        sessionStorage.removeItem("finyk_privat_id");
        sessionStorage.removeItem("finyk_privat_token");
      } else {
        sessionStorage.setItem("finyk_privat_id", cleanId);
        sessionStorage.setItem("finyk_privat_token", cleanToken);
        localStorage.removeItem("finyk_privat_id");
        localStorage.removeItem("finyk_privat_token");
      }
      setPrivatConnected(true);
      window.location.reload();
    } catch (e) {
      setPrivatError(
        e instanceof Error && e.message ? e.message : "Помилка підключення",
      );
    } finally {
      setPrivatConnecting(false);
    }
  };

  const disconnectPrivat = () => {
    try {
      localStorage.removeItem("finyk_privat_id");
      localStorage.removeItem("finyk_privat_token");
      sessionStorage.removeItem("finyk_privat_id");
      sessionStorage.removeItem("finyk_privat_token");
      localStorage.removeItem("finyk_privat_tx_cache");
      localStorage.removeItem("finyk_privat_balance_cache");
    } catch {
      /* storage may be disabled — safe to ignore */
    }
    setPrivatConnected(false);
    setPrivatIdInput("");
    setPrivatTokenInput("");
    setConfirmDisconnectPrivat(false);
    window.location.reload();
  };

  const rawCache = safeReadLS<FinykInfoCache | null>("finyk_info_cache", null);
  const infoData = rawCache?.info ?? rawCache;
  const token = (() => {
    try {
      return (
        localStorage.getItem("finyk_token") ||
        sessionStorage.getItem("finyk_token") ||
        null
      );
    } catch {
      return null;
    }
  })();
  const clientName = infoData?.name ?? null;
  const uahAccounts: UahAccount[] = Array.isArray(infoData?.accounts)
    ? infoData.accounts.filter((a) => a.currencyCode === 980)
    : [];

  const clearTxCache = () => {
    try {
      localStorage.removeItem("finyk_tx_cache");
      localStorage.removeItem("finyk_tx_cache_last_good");
      queryClient.invalidateQueries({ queryKey: hubKeys.preview("finyk") });
    } catch {
      /* storage may be disabled — safe to ignore */
    }
  };

  const disconnect = () => {
    try {
      sessionStorage.removeItem("finyk_token");
      localStorage.removeItem("finyk_token");
      localStorage.removeItem("finyk_token_remembered");
      localStorage.removeItem("finyk_info_cache");
      localStorage.removeItem("finyk_tx_cache");
      localStorage.removeItem("finyk_tx_cache_last_good");
    } catch {
      /* storage may be disabled — safe to ignore */
    }
    window.location.reload();
  };

  const catInputClass =
    "flex-1 min-w-0 h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none focus:border-primary/50 transition-colors";

  return (
    <SettingsGroup title="Фінік" emoji="💳">
      <ConfirmModal
        open={confirmKind !== null}
        title={confirmKind === "cache" ? "Очистити кеш?" : "Вийти з Monobank?"}
        body={
          confirmKind === "cache"
            ? "Буде видалено збережені транзакції в кеші. Потім дані підтягнуться з Monobank знову."
            : "Токен API буде видалено з цього браузера. Потрібно буде ввести його знову."
        }
        confirmLabel={confirmKind === "cache" ? "Очистити" : "Вийти"}
        danger={confirmKind === "disconnect"}
        onCancel={() => setConfirmKind(null)}
        onConfirm={() => {
          if (confirmKind === "cache") clearTxCache();
          if (confirmKind === "disconnect") disconnect();
          setConfirmKind(null);
        }}
      />

      <SettingsSubGroup title="Власні категорії витрат">
        <p className="text-xs text-subtle leading-snug">
          Додаються до списку категорій у транзакціях, сплітах і лімітах (можна
          вказати емодзі на початку назви).
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            placeholder="Напр. 🎨 Хобі"
            maxLength={80}
            className={catInputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCategoryLabel.trim()) {
                addCustomCategory(newCategoryLabel);
                setNewCategoryLabel("");
              }
            }}
          />
          <Button
            type="button"
            className="shrink-0 h-11 px-4"
            onClick={() => {
              addCustomCategory(newCategoryLabel);
              setNewCategoryLabel("");
            }}
          >
            Додати
          </Button>
        </div>
        {customCategories.length > 0 ? (
          <ul className="space-y-0 -mx-4">
            {customCategories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line last:border-0"
              >
                <span className="text-sm font-medium truncate">{c.label}</span>
                <button
                  type="button"
                  onClick={() => removeCustomCategory(c.id)}
                  className="text-xs font-semibold text-danger/80 hover:text-danger shrink-0"
                >
                  Видалити
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-subtle">Поки немає власних категорій.</p>
        )}
      </SettingsSubGroup>

      {uahAccounts.length > 0 && (
        <SettingsSubGroup title="Рахунки">
          <p className="text-xs text-subtle leading-snug">
            Сховані рахунки не враховуються у балансі та нетворсі.
          </p>
          <div className="space-y-0 -mx-4">
            {uahAccounts.map((acc) => {
              const hidden = hiddenAccounts.includes(acc.id);
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {getAccountLabel(acc)}
                    </div>
                    <div className="text-xs text-subtle mt-0.5 tabular-nums">
                      {(acc.balance / 100).toLocaleString("uk-UA", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      ₴
                      {(acc.creditLimit ?? 0) > 0 &&
                        ` · ліміт ${((acc.creditLimit ?? 0) / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleHideAccount(acc.id)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors",
                      hidden
                        ? "border-subtle/50 text-subtle hover:border-muted hover:text-text"
                        : "border-success/40 text-success hover:border-danger/40 hover:text-danger",
                    )}
                  >
                    {hidden ? "Сховано" : "Видно"}
                  </button>
                </div>
              );
            })}
          </div>
        </SettingsSubGroup>
      )}

      {clientName && (
        <SettingsSubGroup title="Monobank">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-panelHi border border-line flex items-center justify-center text-xl">
              {clientName.charAt(0) || "?"}
            </div>
            <div>
              <div className="text-sm font-semibold">{clientName}</div>
              <div className="text-xs text-subtle mt-0.5">
                {uahAccounts.length} UAH рахунків
              </div>
            </div>
          </div>
          {token && (
            <div className="flex items-center gap-2 p-3 bg-bg rounded-xl border border-line">
              <span className="text-xs text-subtle font-mono flex-1 truncate">
                {token.slice(0, 8) + "••••••••••••••••••" + token.slice(-4)}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard?.writeText(token).catch(() => {})
                }
                className="text-xs text-muted hover:text-text transition-colors shrink-0"
              >
                📋 Копіювати
              </button>
            </div>
          )}
        </SettingsSubGroup>
      )}

      <SettingsSubGroup title="Сервіс">
        <p className="text-xs text-subtle leading-snug">
          Якщо список операцій виглядає некоректно — очисти кеш і синхронізуй
          знову.
        </p>
        <Button
          variant="ghost"
          className="w-full h-11"
          onClick={() => setConfirmKind("cache")}
        >
          🧹 Очистити кеш транзакцій
        </Button>
        {token && (
          <Button
            variant="danger"
            className="w-full h-11"
            onClick={() => setConfirmKind("disconnect")}
          >
            Вийти з Monobank
          </Button>
        )}
      </SettingsSubGroup>

      {PRIVAT_ENABLED && (
        <SettingsSubGroup title="ПриватБанк (Приват24 для підприємців)">
          {confirmDisconnectPrivat && (
            <ConfirmModal
              open
              title="Від'єднати ПриватБанк?"
              body="Credentials та кеш транзакцій ПриватБанку буде видалено з цього браузера."
              confirmLabel="Від'єднати"
              danger
              onCancel={() => setConfirmDisconnectPrivat(false)}
              onConfirm={disconnectPrivat}
            />
          )}
          {privatConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-bg border border-green-500/30 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-green-500/12 border border-green-500/20 flex items-center justify-center text-base shrink-0">
                  🏦
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">
                    ПриватБанк підключено
                  </div>
                  <div className="text-xs text-subtle mt-0.5 font-mono truncate">
                    ID: {(privatIdInput || "").slice(0, 6)}••••
                  </div>
                </div>
              </div>
              <Button
                variant="danger"
                className="w-full h-11"
                onClick={() => setConfirmDisconnectPrivat(true)}
              >
                Від{"'"}єднати ПриватБанк
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-subtle leading-snug">
                API Приват24 для підприємців. Merchant ID та токен знаходяться у
                Приват24 Бізнес → Налаштування → API.
              </p>
              <div>
                <label
                  htmlFor="hub-privat-merchant-id"
                  className="text-xs text-muted mb-1 block"
                >
                  Merchant ID
                </label>
                <input
                  id="hub-privat-merchant-id"
                  type="text"
                  value={privatIdInput}
                  onChange={(e) => setPrivatIdInput(e.target.value)}
                  placeholder="Ваш Merchant ID"
                  autoComplete="off"
                  className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="hub-privat-token"
                  className="text-xs text-muted mb-1 block"
                >
                  Токен / пароль
                </label>
                <div className="relative">
                  <input
                    id="hub-privat-token"
                    type={showPrivatToken ? "text" : "password"}
                    value={privatTokenInput}
                    onChange={(e) => setPrivatTokenInput(e.target.value)}
                    placeholder="Merchant token"
                    autoComplete="off"
                    className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 pr-10 text-sm text-text outline-none focus:border-primary/50 transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && connectPrivat()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivatToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-text"
                    aria-label={showPrivatToken ? "Приховати" : "Показати"}
                  >
                    {showPrivatToken ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                  checked={rememberPrivat}
                  onChange={(e) => setRememberPrivat(e.target.checked)}
                />
                <span className="text-sm text-muted">
                  Запам{"'"}ятати на цьому пристрої
                </span>
              </label>
              {privatError && (
                <p className="text-sm text-danger bg-danger/10 rounded-xl px-3 py-2">
                  {privatError}
                </p>
              )}
              <Button
                className="w-full h-11"
                onClick={connectPrivat}
                disabled={privatConnecting}
              >
                {privatConnecting ? "Підключення…" : "Підключити ПриватБанк"}
              </Button>
            </div>
          )}
        </SettingsSubGroup>
      )}
    </SettingsGroup>
  );
}
