import { useState, useCallback, lazy, Suspense } from "react";
import { cn } from "@shared/lib/cn";
import ModuleErrorBoundary from "./ModuleErrorBoundary";

const HubChat = lazy(() => import("./HubChat"));

const FinykApp = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));
const RoutineApp = lazy(() => import("../modules/routine/RoutineApp"));

const HUB_MODULE_KEY = "hub_last_module";
const VALID_MODULES = new Set(["finyk", "fizruk", "routine"]);

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

const MODULES = [
  {
    id: "finyk",
    label: "ФІНІК",
    desc: "Особисті фінанси",
    gradient: "from-emerald-500/12 to-teal-500/8",
    iconClass: "bg-emerald-500/12 text-emerald-600",
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
    iconClass: "bg-[#fff0eb] text-[#c24133] border border-[#f5c4b8]/60",
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
];

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-subtle text-sm animate-pulse">Завантаження...</div>
    </div>
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState(readInitialModule);
  const [chatOpen, setChatOpen] = useState(false);

  const goToHub = useCallback(() => {
    setActiveModule(null);
    persistModuleToUrlAndStorage(null);
  }, []);

  const openModule = useCallback((id, opts = {}) => {
    if (id === "fizruk" && opts.hash) {
      const raw = String(opts.hash).replace(/^#/, "");
      window.location.hash = raw ? `#${raw}` : "#dashboard";
    }
    setActiveModule(id);
    persistModuleToUrlAndStorage(id);
  }, []);

  if (!activeModule) {
    return (
      <div
        className="min-h-dvh bg-bg flex flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <header className="px-6 pt-10 pb-2 max-w-lg mx-auto w-full">
          <h1 className="text-3xl font-bold text-text tracking-tight">
            Мій простір
          </h1>
          <p className="text-sm text-muted mt-1">Обери модуль для початку</p>
        </header>
        <main className="flex-1 px-6 pb-24 max-w-lg mx-auto w-full flex flex-col justify-center">
          <div className="grid gap-4">
            {MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => openModule(m.id)}
                aria-label={`Відкрити модуль ${m.label}: ${m.desc}`}
                className={cn(
                  "group relative w-full p-6 rounded-3xl border border-line bg-panel text-left",
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
                <div className="relative flex items-center gap-5">
                  <div
                    className={cn(
                      "flex items-center justify-center w-16 h-16 rounded-2xl shrink-0 transition-colors",
                      m.iconClass,
                    )}
                    aria-hidden
                  >
                    {m.icon}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-text tracking-tight">
                      {m.label}
                    </h2>
                    <p className="text-sm text-subtle mt-0.5">{m.desc}</p>
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted shrink-0 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
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
            ))}
          </div>
        </main>

        <div
          className="fixed bottom-0 left-0 right-0 flex justify-center pb-6"
          style={{
            paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))",
          }}
        >
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2.5 px-5 h-12 rounded-full bg-primary text-white shadow-float hover:brightness-110 active:scale-95 transition-all font-medium text-sm"
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
      {activeModule !== "fizruk" && activeModule !== "routine" && (
        <div
          className="shrink-0 absolute top-0 left-0 z-50 p-2"
          style={{ paddingTop: "env(safe-area-inset-top, 8px)" }}
        >
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
        </ModuleErrorBoundary>
      </Suspense>
    </div>
  );
}
