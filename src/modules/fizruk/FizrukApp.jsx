import { useEffect, useRef, useState } from "react";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { Dashboard } from "./pages/Dashboard";
import { Atlas } from "./pages/Atlas";
import { Exercise } from "./pages/Exercise";
import { Workouts } from "./pages/Workouts";
import { Progress } from "./pages/Progress";
import { Measurements } from "./pages/Measurements";
import { WorkoutBackupBar } from "./components/workouts/WorkoutBackupBar";
import { PlanCalendar } from "./pages/PlanCalendar";
import { useMonthlyPlan } from "./hooks/useMonthlyPlan";
import { useFizrukWorkoutReminder } from "./hooks/useFizrukWorkoutReminder";
import { cn } from "@shared/lib/cn";

const NAV = [
  {
    id: "dashboard",
    label: "Сьогодні",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "plan",
    label: "План",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "workouts",
    label: "Тренування",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
      </svg>
    ),
  },
  {
    id: "progress",
    label: "Прогрес",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "measurements",
    label: "Заміри",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-2-2h-3" />
        <path d="M8 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
        <path d="M16 3v18" />
        <path d="M8 3v18" />
      </svg>
    ),
  },
];

const VALID_FIZRUK_PAGES = [
  "dashboard",
  "plan",
  "atlas",
  "workouts",
  "progress",
  "measurements",
  "exercise",
];

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

export default function FizrukApp({ onBackToHub } = {}) {
  const [route, setRoute] = useState(() => parseHash());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsPanelRef = useRef(null);
  const page = route.page || "dashboard";
  const isAtlas = page === "atlas";
  const isExercise = page === "exercise";
  const isPlan = page === "plan";

  const monthlyPlan = useMonthlyPlan();
  useFizrukWorkoutReminder({
    enabled: !!monthlyPlan.todayTemplateId,
    reminderHour: monthlyPlan.reminderHour,
    reminderMinute: monthlyPlan.reminderMinute,
  });

  useDialogFocusTrap(settingsOpen, settingsPanelRef, {
    onEscape: () => setSettingsOpen(false),
  });

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 bg-panel/95 backdrop-blur-md border-b border-line/60 z-40 relative"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
          {isAtlas || isExercise ? (
            <button
              type="button"
              onClick={() => setHash("dashboard")}
              className="w-10 h-10 min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
              aria-label="Назад"
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
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : typeof onBackToHub === "function" ? (
            <button
              type="button"
              onClick={onBackToHub}
              className="shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line/80 bg-panel/80"
              aria-label="До вибору модуля"
              title="До хабу"
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
          ) : (
            <div
              className="shrink-0 w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20"
              aria-hidden
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {!isAtlas && !isExercise && (
              <span className="text-[9px] text-success/70 font-bold tracking-widest uppercase block leading-none mb-0.5">
                ОСОБИСТИЙ ЖУРНАЛ
              </span>
            )}
            <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
              {isAtlas
                ? "Атлас"
                : isExercise
                  ? "Вправа"
                  : isPlan
                    ? "План"
                    : "ФІЗРУК"}
            </span>
            {!isAtlas && !isExercise && (
              <span className="text-[10px] text-subtle font-medium truncate">
                {isPlan
                  ? "Календар · нагадування · відновлення"
                  : "Тренування · прогрес"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line/80 bg-panel/80"
            aria-label="Налаштування даних"
            title="Налаштування даних"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[80] flex justify-end"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Закрити налаштування"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            ref={settingsPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fizruk-settings-title"
            className="relative w-full max-w-sm h-full bg-panel border-l border-line shadow-2xl flex flex-col"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line/60">
              <h2
                id="fizruk-settings-title"
                className="text-base font-semibold text-text"
              >
                Дані й резервні копії
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
                aria-label="Закрити"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <WorkoutBackupBar className="border-0 bg-transparent p-0" />
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {page === "dashboard" && (
          <Dashboard onOpenAtlas={() => setHash("atlas")} />
        )}
        {page === "plan" && <PlanCalendar />}
        {page === "atlas" && <Atlas />}
        {page === "workouts" && <Workouts />}
        {page === "progress" && <Progress />}
        {page === "measurements" && <Measurements />}
        {page === "exercise" && <Exercise exerciseId={route.exerciseId} />}
      </div>

      {/* Bottom nav */}
      {!isAtlas && !isExercise && (
        <nav
          className="shrink-0 bg-panel/95 backdrop-blur-md border-t border-line/60 relative z-30"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex h-[58px]">
            {NAV.map((item) => {
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
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-9 h-0.5 rounded-full bg-success"
                      aria-hidden
                    />
                  )}
                  <span className={cn(active && "text-success")}>
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-none font-semibold",
                      active ? "text-text" : "text-muted",
                    )}
                  >
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
