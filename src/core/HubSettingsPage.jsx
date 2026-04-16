import { useCallback, useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { HubBackupPanel } from "./HubBackupPanel.jsx";
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
import { requestNotificationPermission as requestFizrukNotifPermission } from "../modules/fizruk/hooks/useFizrukWorkoutReminder.js";
import {
  loadNutritionPrefs,
  persistNutritionPrefs,
  NUTRITION_PREFS_KEY,
} from "../modules/nutrition/lib/nutritionStorage.js";
import { useStorage as useFinykStorage } from "../modules/finyk/hooks/useStorage.js";
import { getAccountLabel } from "../modules/finyk/utils.js";
import { useToast } from "@shared/hooks/useToast.jsx";

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
      {open && (
        <div className="border-t border-line/60 p-4 space-y-5">
          {children}
        </div>
      )}
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
      {open && <div className="pt-2 space-y-3">{children}</div>}
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

function GeneralSection({ dark, onToggleDark, syncing, onSync, onPull, user }) {
  return (
    <SettingsGroup title="Загальні" emoji="⚙️" defaultOpen>
      <ToggleRow
        label="Темна тема"
        checked={dark}
        onChange={onToggleDark}
      />
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
  const { warning: toastWarning } = useToast();

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

  const handleRemindersToggle = async (checked) => {
    if (checked) {
      const perm = await requestRoutineNotificationPermission();
      if (perm !== "granted") {
        toastWarning(
          "Без дозволу на сповіщення нагадування не надсилатимуться. Дозволь сповіщення у налаштуваннях браузера.",
        );
        return;
      }
    }
    updatePref("routineRemindersEnabled", checked);
  };

  return (
    <SettingsGroup title="Рутина" emoji="✅">
      <ToggleRow
        label="Нагадування в браузері"
        description="У звичці вкажи час нагадування. Нагадування спрацює о вказаній хвилині, якщо день запланований і ще немає відмітки."
        checked={routine.prefs?.routineRemindersEnabled === true}
        onChange={(e) => handleRemindersToggle(e.target.checked)}
      />
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
  const { reminderHour, reminderMinute, setReminder } = useMonthlyPlan();
  const { settings, updateSetting } = useRestSettings();

  const [notifStatus, setNotifStatus] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  const handleEnableNotif = async () => {
    const r = await requestFizrukNotifPermission();
    setNotifStatus(r);
  };

  return (
    <SettingsGroup title="Фізрук" emoji="🏋️">
      <SettingsSubGroup title="Нагадування про тренування">
        <p className="text-[11px] text-subtle leading-snug">
          Час локального нагадування, якщо на сьогодні в календарі обрано шаблон.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Час</span>
            <input
              type="time"
              className="bg-bg border border-line rounded-xl px-3 py-2 text-sm text-text"
              value={`${String(reminderHour).padStart(2, "0")}:${String(reminderMinute).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setReminder(h || 0, m || 0);
              }}
            />
          </label>
          {notifStatus === "granted" ? (
            <span className="text-xs text-success font-medium">Сповіщення увімкнено</span>
          ) : (
            <Button type="button" size="sm" className="h-10" onClick={handleEnableNotif}>
              Дозволити сповіщення
            </Button>
          )}
        </div>
      </SettingsSubGroup>

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

function NutritionSection() {
  const [prefs, setPrefsState] = useState(() => loadNutritionPrefs());

  const updatePrefs = useCallback((updater) => {
    setPrefsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      persistNutritionPrefs(next, NUTRITION_PREFS_KEY);
      return next;
    });
  }, []);

  const [notifStatus, setNotifStatus] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  const handleEnableNotif = async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") {
      try {
        const r = await Notification.requestPermission();
        setNotifStatus(r);
      } catch {
        setNotifStatus("denied");
      }
    } else {
      setNotifStatus("granted");
    }
  };

  return (
    <SettingsGroup title="Харчування" emoji="🥗">
      <SettingsSubGroup title="Нагадування">
        <ToggleRow
          label="Увімкнути нагадування"
          description="Працює лише коли вкладка відкрита (обмеження браузера)."
          checked={Boolean(prefs.reminderEnabled)}
          onChange={(e) => updatePrefs((p) => ({ ...p, reminderEnabled: e.target.checked }))}
        />
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Година</span>
            <input
              type="number"
              min={0}
              max={23}
              className="w-16 h-9 rounded-xl bg-panel border border-line px-2 text-sm text-text"
              value={prefs.reminderHour ?? 12}
              onChange={(e) =>
                updatePrefs((p) => ({
                  ...p,
                  reminderHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                }))
              }
            />
            <span className="text-xs text-subtle">год.</span>
          </label>
          {notifStatus === "granted" ? (
            <span className="text-xs text-success font-medium">Сповіщення дозволені</span>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={handleEnableNotif}>
              Дозвіл на сповіщення
            </Button>
          )}
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
      <RoutineSection />
      <FizrukSection />
      <NutritionSection />
      <FinykSection />
    </div>
  );
}
