import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Atlas } from "./pages/Atlas";
import { Exercise } from "./pages/Exercise";
import { Workouts } from "./pages/Workouts";
import { Progress } from "./pages/Progress";
import { Measurements } from "./pages/Measurements";
import { cn } from "@shared/lib/cn";

const NAV = [
  {
    id: "dashboard", label: "Сьогодні",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    id: "workouts", label: "Тренування",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>,
  },
  {
    id: "progress", label: "Прогрес",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    id: "measurements", label: "Заміри",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-2-2h-3"/><path d="M8 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/><path d="M16 3v18"/><path d="M8 3v18"/></svg>,
  },
];

const VALID_FIZRUK_PAGES = ["dashboard", "atlas", "workouts", "progress", "measurements", "exercise"];

function parseHash() {
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  // Ігноруємо хеш формату Фініка (#/page)
  if (!raw || raw.startsWith("/")) return { page: "dashboard" };
  const [page, ...rest] = raw.split("/").filter(Boolean);
  if (page === "exercise" && rest[0]) return { page, exerciseId: rest[0] };
  if (!VALID_FIZRUK_PAGES.includes(page)) return { page: "dashboard" };
  return { page };
}

function setHash(next) {
  const h = next ? `#${next}` : "#dashboard";
  if (window.location.hash === h) return;
  window.location.hash = h;
}

export default function FizrukApp() {
  const [route, setRoute] = useState(() => parseHash());
  const page = route.page || "dashboard";
  const isAtlas = page === "atlas";
  const isExercise = page === "exercise";

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-panel/95 backdrop-blur-md border-b border-line/60 z-40 relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
          {isAtlas || isExercise ? (
            <button
              type="button"
              onClick={() => setHash("dashboard")}
              className="w-10 h-10 min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
              aria-label="Назад"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : (
            <div className="shrink-0 w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {!isAtlas && !isExercise && (
              <span className="text-[9px] text-success/70 font-bold tracking-widest uppercase block leading-none mb-0.5">ОСОБИСТИЙ ЖУРНАЛ</span>
            )}
            <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
              {isAtlas ? "Атлас" : isExercise ? "Вправа" : "ФІЗРУК"}
            </span>
            {!isAtlas && !isExercise && (
              <span className="text-[10px] text-subtle font-medium truncate">Тренування · прогрес</span>
            )}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {page === "dashboard" && <Dashboard onOpenAtlas={() => setHash("atlas")} />}
        {page === "atlas" && <Atlas />}
        {page === "workouts" && <Workouts />}
        {page === "progress" && <Progress />}
        {page === "measurements" && <Measurements />}
        {page === "exercise" && <Exercise exerciseId={route.exerciseId} />}
      </div>

      {/* Bottom nav */}
      {!isAtlas && !isExercise && (
        <nav className="shrink-0 bg-panel/95 backdrop-blur-md border-t border-line/60 relative z-30" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex h-[58px]">
            {NAV.map(item => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHash(item.id)}
                  className={cn(
                    "relative flex-1 flex flex-col items-center justify-center gap-1 transition-all min-h-[48px]",
                    active ? "text-text" : "text-muted",
                  )}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-9 h-0.5 rounded-full bg-success" aria-hidden />
                  )}
                  <span className={cn(active && "text-success")}>{item.icon}</span>
                  <span className={cn("text-[11px] leading-none font-semibold", active ? "text-text" : "text-muted")}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
