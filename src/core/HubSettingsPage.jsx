import { useCallback, useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { HubBackupPanel } from "./HubBackupPanel.jsx";
import { resetDashboardOrder } from "./HubDashboard.jsx";
import { useWeeklyDigest } from "./useWeeklyDigest.js";
import {
  loadRoutineState,
  setPref,
} from "../modules/routine/lib/routineStorage.js";
import { requestRoutineNotificationPermission } from "../modules/routine/hooks/useRoutineReminders.js";
import { useMonthlyPlan } from "../modules/fizruk/hooks/useMonthlyPlan.js";
import {
  useRestSettings,
  REST_CATEGORY_LABELS,
} from "../modules/fizruk/hooks/useRestSettings.js";
import {
  loadNutritionPrefs,
  persistNutritionPrefs,
  NUTRITION_PREFS_KEY,
} from "../modules/nutrition/lib/nutritionStorage.js";
import { useStorage as useFinykStorage } from "../modules/finyk/hooks/useStorage.js";
import { getAccountLabel } from "../modules/finyk/utils.js";
import { useToast } from "@shared/hooks/useToast.jsx";

const PRIVAT_ENABLED = false;

function safeParseLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-200 shrink-0", expanded && "rotate-90")}
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SettingsGroup({ title, emoji, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-line bg-panel shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-2 hover:bg-panelHi/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {emoji && <span className="text-base">{emoji}</span>}
          <span className="text-sm font-semibold text-text">{title}</span>
        </div>
        <ChevronIcon expanded={open} />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line/60 p-4 space-y-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSubGroup({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left group mb-1"
      >
        <ChevronIcon expanded={open} />
        <span className="text-xs font-bold text-muted uppercase tracking-widest group-hover:text-text transition-colors">
          {title}
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-2 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer group">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text">{label}</span>
        {description && (
          <p className="text-[11px] text-subtle mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      <div className="shrink-0 pt-0.5">
        <input
          type="checkbox"
          className="w-5 h-5 accent-primary cursor-pointer"
          checked={checked}
          onChange={onChange}
        />
      </div>
    </label>
  );
}

function ConfirmModal({ open, title, body, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Закрити"
      />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-2xl shadow-soft p-5 z-10">
        <h2 className="text-base font-bold text-text">{title}</h2>
        {body && <p className="text-sm text-muted mt-2">{body}</p>}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            className="flex-1 py-3 rounded-xl border border-line text-sm font-semibold text-muted hover:bg-panelHi transition-colors"
            onClick={onCancel}
          >
            Скасувати
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors",
              danger ? "bg-danger hover:bg-danger/90" : "bg-emerald-600 hover:bg-emerald-700",
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [permStatus, setPermStatus] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const { warning: toastWarning } = useToast();

  const [routine, setRoutine] = useState(() => loadRoutineState());
  useEffect(() => {
    const handler = () => setRoutine(loadRoutineState());
    const storageHandler = (e) => {
      if (e.key === "hub_routine_v1" || e.key === null) handler();
    };
    window.addEventListener("hub-routine-storage", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("hub-routine-storage", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const monthlyPlan = useMonthlyPlan();

  const [nutritionPrefs, setNutritionPrefs] = useState(() => loadNutritionPrefs());
  useEffect(() => {
    const handler = (e) => {
      if (e.key === NUTRITION_PREFS_KEY || e.key === null) {
        setNutritionPrefs(loadNutritionPrefs());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const r = await Notification.requestPermission();
      setPermStatus(r);
      if (r !== "granted") {
        toastWarning("Дозволь сповіщення в налаштуваннях браузера, щоб отримувати нагадування.");
      }
    } catch {
      setPermStatus("denied");
    }
  };

  const updateRoutinePref = (key, value) => {
    setRoutine((s) => setPref(s, key, value));
  };

  const handleRoutineToggle = async (checked) => {
    if (checked) {
      const perm = await requestRoutineNotificationPermission();
      setPermStatus(perm);
      if (perm !== "granted") {
        toastWarning("Без дозволу на сповіщення нагадування не надсилатимуться. Дозволь сповіщення у налаштуваннях браузера.");
        return;
      }
    }
    updateRoutinePref("routineRemindersEnabled", checked);
  };

  const handleFizrukToggle = async (checked) => {
    if (checked && permStatus !== "granted") {
      const perm = await requestRoutineNotificationPermission();
      setPermStatus(perm);
      if (perm !== "granted") {
        toastWarning("Без дозволу на сповіщення нагадування не надсилатимуться.");
        return;
      }
    }
    monthlyPlan.setReminderEnabled(checked);
  };

  const handleNutritionToggle = async (checked) => {
    if (checked && permStatus !== "granted") {
      const perm = await requestRoutineNotificationPermission();
      setPermStatus(perm);
      if (perm !== "granted") {
        toastWarning("Без дозволу на сповіщення нагадування не надсилатимуться.");
        return;
      }
    }
    const next = { ...nutritionPrefs, reminderEnabled: checked };
    persistNutritionPrefs(next, NUTRITION_PREFS_KEY);
    setNutritionPrefs(next);
  };

  const permLabel = {
    granted: "Дозволено",
    denied: "Заблоковано",
    default: "Не встановлено",
    unsupported: "Не підтримується",
  }[permStatus] ?? "Невідомо";

  const permColor = {
    granted: "text-success",
    denied: "text-danger",
    default: "text-warning",
    unsupported: "text-muted",
  }[permStatus] ?? "text-muted";

  return (
    <SettingsGroup title="Сповіщення" emoji="🔔" defaultOpen>
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-bg border border-line">
        <div>
          <p className="text-sm font-semibold text-text">Push-сповіщення</p>
          <p className={cn("text-xs mt-0.5 font-medium", permColor)}>{permLabel}</p>
        </div>
        {permStatus !== "granted" && permStatus !== "unsupported" && (
          <Button type="button" size="sm" className="h-9 shrink-0" onClick={requestPermission}>
            Дозволити
          </Button>
        )}
        {permStatus === "denied" && (
          <p className="text-[11px] text-subtle">Відкрий налаштування браузера, щоб дозволити</p>
        )}
      </div>

      <SettingsSubGroup title="Звички (Рутина)" defaultOpen>
        <ToggleRow
          label="Нагадування про звички"
          description="Спрацьовує у встановлений в кожній звичці час, навіть коли застосунок закрито."
          checked={routine.prefs?.routineRemindersEnabled === true}
          onChange={(e) => handleRoutineToggle(e.target.checked)}
        />
      </SettingsSubGroup>

      <SettingsSubGroup title="Тренування (Фізрук)" defaultOpen>
        <ToggleRow
          label="Нагадування про тренування"
          description="Надсилається о вказаній годині, якщо на сьогодні призначено тренування."
          checked={monthlyPlan.reminderEnabled}
          onChange={(e) => handleFizrukToggle(e.target.checked)}
        />
        {monthlyPlan.reminderEnabled && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Час</span>
            <input
              type="time"
              className="bg-bg border border-line rounded-xl px-3 py-2 text-sm text-text"
              value={`${String(monthlyPlan.reminderHour).padStart(2, "0")}:${String(monthlyPlan.reminderMinute).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                monthlyPlan.setReminder(h || 0, m || 0);
              }}
            />
          </label>
        )}
      </SettingsSubGroup>

      <SettingsSubGroup title="Харчування" defaultOpen>
        <ToggleRow
          label="Нагадування про їжу"
          description="Щоденне нагадування записати прийоми їжі, навіть коли застосунок закрито."
          checked={Boolean(nutritionPrefs.reminderEnabled)}
          onChange={(e) => handleNutritionToggle(e.target.checked)}
        />
        {nutritionPrefs.reminderEnabled && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Година</span>
            <input
              type="number"
              min={0}
              max={23}
              className="w-16 h-9 rounded-xl bg-panel border border-line px-2 text-sm text-text"
              value={nutritionPrefs.reminderHour ?? 12}
              onChange={(e) => {
                const next = {
                  ...nutritionPrefs,
                  reminderHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                };
                persistNutritionPrefs(next, NUTRITION_PREFS_KEY);
                setNutritionPrefs(next);
              }}
            />
            <span className="text-xs text-subtle">год.</span>
          </label>
        )}
      </SettingsSubGroup>
    </SettingsGroup>
  );
}

function GeneralSection({ dark, onToggleDark, syncing, onSync, onPull, user }) {
  const [orderReset, setOrderReset] = useState(false);

  const handleResetOrder = () => {
    resetDashboardOrder();
    setOrderReset(true);
    setTimeout(() => setOrderReset(false), 2000);
  };

  return (
    <SettingsGroup title="Загальні" emoji="⚙️">
      <ToggleRow
        label="Темна тема"
        checked={dark}
        onChange={onToggleDark}
      />
      <SettingsSubGroup title="Дашборд">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-full"
          onClick={handleResetOrder}
          disabled={orderReset}
        >
          {orderReset ? "✓ Порядок скинуто" : "🔄 Скинути порядок блоків"}
        </Button>
      </SettingsSubGroup>
      {user && (
        <SettingsSubGroup title="Хмарна синхронізація">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 flex-1"
              disabled={syncing}
              onClick={onSync}
            >
              {syncing ? "Зберігаємо…" : "Зберегти в хмару"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 flex-1"
              disabled={syncing}
              onClick={onPull}
            >
              {syncing ? "Завантаження…" : "Завантажити з хмари"}
            </Button>
          </div>
        </SettingsSubGroup>
      )}
      <SettingsSubGroup title="Резервна копія Hub" defaultOpen>
        <HubBackupPanel />
      </SettingsSubGroup>
    </SettingsGroup>
  );
}

function RoutineSection() {
  const [routine, setRoutine] = useState(() => loadRoutineState());

  useEffect(() => {
    const handler = () => setRoutine(loadRoutineState());
    const storageHandler = (e) => {
      if (e.key === "hub_routine_v1" || e.key === null) handler();
    };
    window.addEventListener("hub-routine-storage", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("hub-routine-storage", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const updatePref = useCallback((key, value) => {
    setRoutine((s) => setPref(s, key, value));
  }, []);

  return (
    <SettingsGroup title="Рутина" emoji="✅">
      <ToggleRow
        label="Показувати тренування з Фізрука в календарі"
        checked={routine.prefs?.showFizrukInCalendar !== false}
        onChange={(e) => updatePref("showFizrukInCalendar", e.target.checked)}
      />
      <ToggleRow
        label="Показувати планові платежі підписок Фініка в календарі"
        checked={routine.prefs?.showFinykSubscriptionsInCalendar !== false}
        onChange={(e) => updatePref("showFinykSubscriptionsInCalendar", e.target.checked)}
      />
    </SettingsGroup>
  );
}

function FizrukSection() {
  const { settings, updateSetting } = useRestSettings();

  return (
    <SettingsGroup title="Фізрук" emoji="🏋️">
      <SettingsSubGroup title="Таймер відпочинку">
        <p className="text-[11px] text-subtle leading-snug">
          Рекомендований час відпочинку підбирається автоматично за типом вправи.
          Ці значення з&apos;являться як кнопка за замовчуванням у кожній вправі.
        </p>
        <div className="space-y-3">
          {Object.entries(REST_CATEGORY_LABELS).map(([cat, label]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="text-xs text-text flex-1 min-w-0">{label}</span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {[30, 60, 90, 120, 180].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updateSetting(cat, sec)}
                    className={cn(
                      "h-9 w-14 rounded-xl border text-xs font-semibold transition-colors",
                      settings[cat] === sec
                        ? "border-success bg-success/15 text-success"
                        : "border-line bg-panelHi text-subtle hover:text-text",
                    )}
                  >
                    {sec}с
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SettingsSubGroup>
    </SettingsGroup>
  );
}


function FinykSection() {
  const {
    hiddenAccounts,
    toggleHideAccount,
    customCategories,
    addCustomCategory,
    removeCustomCategory,
  } = useFinykStorage({});

  const [confirmKind, setConfirmKind] = useState(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const [privatIdInput, setPrivatIdInput] = useState(() => {
    try {
      return localStorage.getItem("finyk_privat_id") || sessionStorage.getItem("finyk_privat_id") || "";
    } catch { return ""; }
  });
  const [privatTokenInput, setPrivatTokenInput] = useState(() => {
    try {
      return localStorage.getItem("finyk_privat_token") || sessionStorage.getItem("finyk_privat_token") || "";
    } catch { return ""; }
  });
  const [showPrivatToken, setShowPrivatToken] = useState(false);
  const [rememberPrivat, setRememberPrivat] = useState(() => {
    try {
      return !!localStorage.getItem("finyk_privat_id");
    } catch { return false; }
  });
  const [privatError, setPrivatError] = useState("");
  const [privatConnecting, setPrivatConnecting] = useState(false);
  const [privatConnected, setPrivatConnected] = useState(() => {
    try {
      return !!(localStorage.getItem("finyk_privat_id") || sessionStorage.getItem("finyk_privat_id"));
    } catch { return false; }
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
      const { apiUrl } = await import("@shared/lib/apiUrl.js");
      const params = new URLSearchParams({
        path: "/statements/balance/final",
        country: "UA",
        showRest: "true",
      });
      const res = await fetch(`${apiUrl("/api/privat")}?${params}`, {
        headers: { "X-Privat-Id": cleanId, "X-Privat-Token": cleanToken },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setPrivatError(payload?.error || `Помилка ${res.status}`);
        return;
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
      setPrivatError(e?.message || "Помилка підключення");
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
    } catch {}
    setPrivatConnected(false);
    setPrivatIdInput("");
    setPrivatTokenInput("");
    setConfirmDisconnectPrivat(false);
    window.location.reload();
  };

  const rawCache = safeParseLS("finyk_info_cache", null);
  const infoData = rawCache?.info ?? rawCache;
  const token = (() => {
    try {
      return (
        localStorage.getItem("finyk_token") ||
        sessionStorage.getItem("finyk_token") ||
        null
      );
    } catch { return null; }
  })();
  const clientName = infoData?.name ?? null;
  const uahAccounts = Array.isArray(infoData?.accounts)
    ? infoData.accounts.filter((a) => a.currencyCode === 980)
    : [];

  const clearTxCache = () => {
    try {
      localStorage.removeItem("finyk_tx_cache");
      localStorage.removeItem("finyk_tx_cache_last_good");
      window.dispatchEvent(new CustomEvent("hub-finyk-cache-updated"));
    } catch {}
  };

  const disconnect = () => {
    try {
      sessionStorage.removeItem("finyk_token");
      localStorage.removeItem("finyk_token");
      localStorage.removeItem("finyk_token_remembered");
      localStorage.removeItem("finyk_info_cache");
      localStorage.removeItem("finyk_tx_cache");
      localStorage.removeItem("finyk_tx_cache_last_good");
    } catch {}
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
        <p className="text-[11px] text-subtle leading-snug">
          Додаються до списку категорій у транзакціях, сплітах і лімітах (можна вказати емодзі на початку назви).
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
                className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line/60 last:border-0"
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
          <p className="text-[11px] text-subtle leading-snug">
            Сховані рахунки не враховуються у балансі та нетворсі.
          </p>
          <div className="space-y-0 -mx-4">
            {uahAccounts.map((acc) => {
              const hidden = hiddenAccounts.includes(acc.id);
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-line/60 last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium">{getAccountLabel(acc)}</div>
                    <div className="text-xs text-subtle mt-0.5 tabular-nums">
                      {(acc.balance / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                      {acc.creditLimit > 0 &&
                        ` · ліміт ${(acc.creditLimit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`}
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
              <div className="text-xs text-subtle mt-0.5">{uahAccounts.length} UAH рахунків</div>
            </div>
          </div>
          {token && (
            <div className="flex items-center gap-2 p-3 bg-bg rounded-xl border border-line">
              <span className="text-xs text-subtle font-mono flex-1 truncate">
                {token.slice(0, 8) + "••••••••••••••••••" + token.slice(-4)}
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(token).catch(() => {})}
                className="text-xs text-muted hover:text-text transition-colors shrink-0"
              >
                📋 Копіювати
              </button>
            </div>
          )}
        </SettingsSubGroup>
      )}

      <SettingsSubGroup title="Сервіс">
        <p className="text-[11px] text-subtle leading-snug">
          Якщо список операцій виглядає некоректно — очисти кеш і синхронізуй знову.
        </p>
        <Button variant="ghost" className="w-full h-11" onClick={() => setConfirmKind("cache")}>
          🧹 Очистити кеш транзакцій
        </Button>
        {token && (
          <Button variant="danger" className="w-full h-11" onClick={() => setConfirmKind("disconnect")}>
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
                <div className="text-sm font-semibold text-text">ПриватБанк підключено</div>
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
              Від'єднати ПриватБанк
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-subtle leading-snug">
              API Приват24 для підприємців. Merchant ID та токен знаходяться у Приват24 Бізнес → Налаштування → API.
            </p>
            <div>
              <label className="text-xs text-muted mb-1 block">Merchant ID</label>
              <input
                type="text"
                value={privatIdInput}
                onChange={(e) => setPrivatIdInput(e.target.value)}
                placeholder="Ваш Merchant ID"
                autoComplete="off"
                className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Токен / пароль</label>
              <div className="relative">
                <input
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
              <span className="text-sm text-muted">Запам'ятати на цьому пристрої</span>
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
              {privatConnecting ? "Підключення..." : "Підключити ПриватБанк"}
            </Button>
          </div>
        )}
      </SettingsSubGroup>
      )}
    </SettingsGroup>
  );
}

function AIDigestSection() {
  const { digest, loading, error, weekRange, generate } = useWeeklyDigest();
  const [done, setDone] = useState(false);
  const { success: toastSuccess } = useToast();

  const handleGenerate = async () => {
    setDone(false);
    const result = await generate();
    if (result) {
      setDone(true);
      toastSuccess("Звіт тижня згенеровано!");
    }
  };

  const generatedAt = digest?.generatedAt
    ? new Date(digest.generatedAt).toLocaleDateString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <SettingsGroup title="AI Звіт тижня" emoji="📋">
      <div className="space-y-3">
        <p className="text-[11px] text-subtle leading-snug">
          Тижневий AI-аналіз прогресу по всіх модулях: фінанси, тренування, харчування та звички.
          Звіт доступний на дашборді щопонеділка або за запитом.
        </p>
        <div className="p-3 rounded-xl bg-bg border border-line">
          <p className="text-xs font-semibold text-text">Поточний тиждень</p>
          <p className="text-[11px] text-muted mt-0.5">{weekRange}</p>
          {generatedAt && (
            <p className="text-[10px] text-subtle mt-1">Згенеровано: {generatedAt}</p>
          )}
        </div>
        {error && (
          <p className="text-xs text-danger bg-danger/10 rounded-xl px-3 py-2">{error}</p>
        )}
        <Button
          type="button"
          className="w-full h-11"
          disabled={loading}
          onClick={handleGenerate}
        >
          {loading ? "Генерую…" : done ? "✓ Звіт готовий" : digest ? "Оновити звіт тижня" : "Згенерувати звіт зараз"}
        </Button>
      </div>
    </SettingsGroup>
  );
}

export function HubSettingsPage({ dark, onToggleDark, syncing, onSync, onPull, user }) {
  return (
    <div className="flex flex-col gap-3 pt-2 pb-4">
      <GeneralSection
        dark={dark}
        onToggleDark={onToggleDark}
        syncing={syncing}
        onSync={onSync}
        onPull={onPull}
        user={user}
      />
      <AIDigestSection />
      <NotificationsSection />
      <RoutineSection />
      <FizrukSection />
      <FinykSection />
    </div>
  );
}
