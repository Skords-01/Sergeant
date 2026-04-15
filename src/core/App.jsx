import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { cn } from "@shared/lib/cn";
import ModuleErrorBoundary from "./ModuleErrorBoundary";
import { HubBackupPanel } from "./HubBackupPanel.jsx";
import { useDarkMode } from "@shared/hooks/useDarkMode";
import { Button } from "@shared/components/ui/Button";

/** Detects online/offline state and shows a banner when offline */
function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 px-4 py-2 bg-warning text-white text-xs font-semibold safe-area-pt shadow-soft"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
      Немає підключення до інтернету
    </div>
  );
}

import RoutineApp from "../modules/routine/RoutineApp.jsx";

const HubChat = lazy(() => import("./HubChat"));

const FinykApp = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));
const NutritionApp = lazy(() => import("../modules/nutrition/NutritionApp"));

const HUB_MODULE_KEY = "hub_last_module";
const HUB_MODULE_HASHES_KEY = "hub_module_hashes_v1";
const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);

function readModuleHashes() {
  try {
    const raw = localStorage.getItem(HUB_MODULE_HASHES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeModuleHashes(next) {
  try {
    localStorage.setItem(HUB_MODULE_HASHES_KEY, JSON.stringify(next || {}));
  } catch {
    /* ignore */
  }
}

function persistLastHashForModule(moduleId, hash) {
  const id = String(moduleId || "").trim();
  if (!VALID_MODULES.has(id)) return;
  const h = String(hash || "").trim();
  if (!h || h === "#") return;
  const map = readModuleHashes();
  map[id] = h.startsWith("#") ? h : `#${h}`;
  writeModuleHashes(map);
}

function readLastHashForModule(moduleId) {
  const id = String(moduleId || "").trim();
  if (!VALID_MODULES.has(id)) return "";
  const map = readModuleHashes();
  const h = map?.[id];
  return typeof h === "string" ? h : "";
}

function readInitialModule() {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("module");
    if (VALID_MODULES.has(q)) return q;
  } catch {}
  try {
    const s = localStorage.getItem(HUB_MODULE_KEY);
    if (VALID_MODULES.has(s)) return s;
  } catch {}
  return null;
}

function persistModuleToUrlAndStorage(moduleId) {
  try {
    if (moduleId) localStorage.setItem(HUB_MODULE_KEY, moduleId);
    else localStorage.removeItem(HUB_MODULE_KEY);
  } catch {}
  try {
    const url = new URL(window.location.href);
    if (moduleId) url.searchParams.set("module", moduleId);
    else url.searchParams.delete("module");
    window.history.replaceState(null, "", url);
  } catch {}
}

/** Read a quick status badge from localStorage for each module (no imports, no deps). */
function readModuleStatus(id) {
  try {
    if (id === "finyk") {
      const raw = localStorage.getItem("finyk_info_cache");
      if (!raw) return null;
      const info = JSON.parse(raw);
      const accs = info?.accounts ?? [];
      if (!accs.length) return null;
      const total = accs.reduce((s, a) => s + (a.balance ?? 0), 0) / 100;
      return `${total.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`;
    }
    if (id === "fizruk") {
      const raw = localStorage.getItem("fizruk_workouts_v1");
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const thisWeek = arr.filter((w) => {
        if (!w.endedAt) return false;
        const d = new Date(w.startedAt);
        const now = new Date();
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        mon.setHours(0, 0, 0, 0);
        return d >= mon;
      });
      return `${thisWeek.length} трен. цього тижня`;
    }
    if (id === "routine") {
      const raw = localStorage.getItem("hub_routine_v1");
      if (!raw) return null;
      const state = JSON.parse(raw);
      const habits = state?.habits ?? [];
      const active = habits.filter((h) => !h.archived);
      if (!active.length) return null;
      const now = new Date();
      // dateKeyFromDate equivalent — local date
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const completions = state?.completions ?? {};
      // completions structure: { habitId: ["2026-04-13", ...] }
      const done = active.filter((h) =>
        Array.isArray(completions[h.id]) && completions[h.id].includes(today),
      );
      return `${done.length}/${active.length} звичок`;
    }
  } catch {}
  return null;
}

const MODULES = [
  {
    id: "finyk",
    label: "ФІНІК",
    desc: "Особисті фінанси",
    gradient: "from-emerald-500/12 to-teal-500/8",
    iconClass: "bg-emerald-500/12 text-emerald-600",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: "fizruk",
    label: "ФІЗРУК",
    desc: "Фітнес і тренування",
    gradient: "from-sky-500/12 to-indigo-500/8",
    iconClass: "bg-sky-500/12 text-sky-600",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
      </svg>
    ),
  },
  {
    id: "routine",
    label: "РУТИНА",
    desc: "Календар Hub, звички, план",
    gradient: "from-orange-400/15 to-rose-400/10",
    iconClass:
      "bg-routine-surface text-routine-strong border border-routine-line/60",
    badgeClass: "bg-routine-surface text-routine-strong",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    id: "nutrition",
    label: "ХАРЧУВАННЯ",
    desc: "Фото → КБЖВ · Рецепти · Поради",
    gradient: "from-lime-400/15 to-emerald-400/10",
    iconClass: "bg-lime-500/12 text-lime-700",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11c0 6 4 10 8 10s8-4 8-10" />
        <path d="M12 21V11" />
        <path d="M7 5c0 2 1 3 2 4M17 5c0 2-1 3-2 4" />
        <path d="M7 5c0-1 1-2 2-2s2 1 2 2c0 2-2 4-2 6" />
        <path d="M17 5c0-1-1-2-2-2s-2 1-2 2c0 2 2 4 2 6" />
      </svg>
    ),
  },
];

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-subtle text-sm animate-pulse">Завантаження...</div>
    </div>
  );
}

/** Sun/Moon icon toggle for dark mode */
function DarkModeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      title={dark ? "Світла тема" : "Темна тема"}
      className="w-10 h-10 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors"
    >
      {dark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/** PWA install banner — shows only when browser fires beforeinstallprompt */
function usePwaInstall() {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  }, [prompt]);

  const dismiss = useCallback(() => setPrompt(null), []);

  return { canInstall: !!prompt, install, dismiss };
}

export default function App() {
  const [activeModule, setActiveModule] = useState(readInitialModule);
  const [chatOpen, setChatOpen] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();
  const { canInstall, install, dismiss } = usePwaInstall();
  const online = useOnlineStatus();

  const goToHub = useCallback(() => {
    try {
      if (activeModule) {
        persistLastHashForModule(activeModule, window.location.hash);
      }
    } catch {
      /* ignore */
    }
    setActiveModule(null);
    persistModuleToUrlAndStorage(null);
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", url);
    } catch {}
  }, [activeModule]);

  const openModule = useCallback((id, opts = {}) => {
    const nextId = String(id || "").trim();
    const isSame = nextId && nextId === activeModule;

    try {
      if (!isSame && activeModule) {
        persistLastHashForModule(activeModule, window.location.hash);
      }

      const raw = opts.hash != null ? String(opts.hash).trim() : "";
      if (raw) {
        window.location.hash = raw.startsWith("#") ? raw : `#${raw}`;
      } else if (!isSame) {
        const saved = readLastHashForModule(nextId);
        if (saved) window.location.hash = saved;
        else window.location.hash = "";
      }
    } catch {
      /* ignore */
    }
    setActiveModule(nextId);
    persistModuleToUrlAndStorage(nextId);
  }, [activeModule]);

  if (!activeModule) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col safe-area-pt-pb">
        {!online && <OfflineBanner />}
        <header className="px-5 pt-10 pb-2 max-w-lg mx-auto w-full flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text tracking-tight">
              Мій простір
            </h1>
            <p className="text-sm text-muted mt-1">Обери модуль для початку</p>
          </div>
          <div className="pt-1">
            <DarkModeToggle dark={dark} onToggle={toggleDark} />
          </div>
        </header>

        {/* PWA install banner */}
        {canInstall && (
          <div className="mx-5 max-w-lg mx-auto w-full mb-2 px-4 py-3 rounded-2xl bg-primary/8 border border-line flex items-center gap-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary shrink-0"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="text-sm text-text flex-1">
              Встановити як додаток
            </span>
            <button
              onClick={install}
              className="text-sm font-semibold text-primary hover:underline shrink-0"
            >
              Встановити
            </button>
            <button
              onClick={dismiss}
              className="text-muted hover:text-text shrink-0"
              aria-label="Закрити"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <main className="flex-1 px-5 pb-24 max-w-lg mx-auto w-full flex flex-col justify-center gap-3">
          {MODULES.map((m) => {
            const badge = readModuleStatus(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => openModule(m.id)}
                aria-label={`Відкрити модуль ${m.label}: ${m.desc}`}
                className={cn(
                  "group relative w-full p-5 rounded-3xl border border-line bg-panel text-left",
                  "shadow-card hover:shadow-float transition-all duration-300",
                  "active:scale-[0.98] overflow-hidden",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-text/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                    m.gradient,
                  )}
                />
                <div className="relative flex items-center gap-4">
                  <div
                    className={cn(
                      "flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 transition-colors",
                      m.iconClass,
                    )}
                    aria-hidden
                  >
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[17px] font-semibold text-text tracking-tight">
                        {m.label}
                      </h2>
                      {badge && (
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                            m.badgeClass,
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-subtle mt-0.5">{m.desc}</p>
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    aria-hidden
                  >
                    <path
                      d="M9 18l6-6-6-6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            );
          })}

          <div className="mt-1">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2 px-1">
              Швидкі дії
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModule("nutrition", { hash: "log" })}
                aria-label="Харчування: відкрити журнал"
              >
                Харчування · Журнал
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModule("nutrition", { hash: "recipes" })}
                aria-label="Харчування: відкрити рецепти"
              >
                Харчування · Рецепти
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModule("fizruk", { hash: "workouts" })}
                aria-label="Фізрук: відкрити тренування"
              >
                Фізрук · Тренування
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openModule("finyk", { hash: "/transactions" })}
                aria-label="Фінік: відкрити транзакції"
              >
                Фінік · Транзакції
              </Button>
            </div>
          </div>

          <HubBackupPanel className="mt-2" />
        </main>

        <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2.5 px-5 h-12 rounded-full bg-primary text-bg shadow-float hover:brightness-110 active:scale-95 transition-all font-medium text-sm"
            aria-label="Відкрити асистента (фінанси та тренування)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Асистент
          </button>
        </div>

        {chatOpen && (
          <Suspense fallback={null}>
            <HubChat onClose={() => setChatOpen(false)} />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      {!online && <OfflineBanner />}
      {activeModule !== "fizruk" && activeModule !== "routine" && (
        <div className="shrink-0 absolute top-0 left-0 z-50 p-2 safe-area-pt-8">
          <button
            type="button"
            onClick={goToHub}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-panel/90 backdrop-blur-md border border-line/80 text-muted hover:text-text shadow-card transition-colors"
            title="До вибору модуля"
            aria-label="До вибору модуля"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        </div>
      )}

      <Suspense fallback={<PageLoader />}>
        <ModuleErrorBoundary key={activeModule} onBackToHub={goToHub}>
          {activeModule === "finyk" && <FinykApp onBackToHub={goToHub} />}
          {activeModule === "fizruk" && <FizrukApp onBackToHub={goToHub} />}
          {activeModule === "routine" && (
            <RoutineApp onBackToHub={goToHub} onOpenModule={openModule} />
          )}
          {activeModule === "nutrition" && (
            <NutritionApp onBackToHub={goToHub} />
          )}
        </ModuleErrorBoundary>
      </Suspense>
    </div>
  );
}
