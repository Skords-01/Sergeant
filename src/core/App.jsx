import { useState } from "react";
import { cn } from "@shared/lib/cn";

// Модулі — ліниво завантажуємо
import { lazy, Suspense } from "react";
const FinykApp  = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));

const MODULES = [
  {
    id: "finyk",
    label: "ФІНІК",
    desc: "Особисті фінанси",
    gradient: "from-emerald-500/12 to-teal-500/8",
    iconClass: "bg-emerald-500/12 text-emerald-600",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
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
  const [activeModule, setActiveModule] = useState(null);

  // Головний екран — вибір модуля
  if (!activeModule) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <div className="text-center mb-10">
          <div className="text-2xl font-bold tracking-wide text-text mb-1">Мій простір</div>
          <div className="text-sm text-subtle">Обери модуль</div>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className="bg-panel border border-line rounded-3xl p-6 flex flex-col items-center gap-3 shadow-card hover:shadow-float hover:border-muted/50 transition-all active:scale-95"
            >
              <span className="text-text opacity-70">{m.icon}</span>
              <div>
                <div className="text-sm font-bold text-text">{m.label}</div>
                <div className="text-xs text-subtle">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      {/* Back to hub */}
      <div className="shrink-0 absolute top-0 left-0 z-50 p-2" style={{ paddingTop: "env(safe-area-inset-top, 8px)" }}>
        <button
          type="button"
          onClick={() => setActiveModule(null)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-panel/90 backdrop-blur-md border border-line/80 text-muted hover:text-text shadow-card transition-colors"
          title="До вибору модуля"
          aria-label="До вибору модуля"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      </div>

      <Suspense fallback={<PageLoader />}>
        {activeModule === "finyk"  && <FinykApp />}
        {activeModule === "fizruk" && <FizrukApp />}
      </Suspense>
    </div>
  );
}
