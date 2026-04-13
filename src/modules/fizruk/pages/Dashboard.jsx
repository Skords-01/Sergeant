import { Button } from "@shared/components/ui/Button";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useEffect, useMemo, useRef, useState } from "react";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useWorkouts } from "../hooks/useWorkouts";
import { useMonthlyPlan } from "../hooks/useMonthlyPlan";
import { BodyAtlas } from "../components/BodyAtlas";
import { recoveryConflictsForExercise } from "../lib/recoveryConflict";
import {
  completedWorkoutsCount,
  countCompletedInCurrentWeek,
  formatCompactKg,
  personalRecordsExerciseCount,
  totalCompletedVolumeKg,
  workoutDurationSec,
} from "../lib/workoutStats";
import { ACTIVE_WORKOUT_KEY } from "../lib/workoutUi.js";

const SELECTED_TEMPLATE_KEY = "fizruk_selected_template_id_v1";

function formatDurShort(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s} с`;
  return `${m} хв ${s} с`;
}

export function Dashboard({ onOpenAtlas }) {
  const today = new Date().toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const rec = useRecovery();
  const { workouts, createWorkout, addItem } = useWorkouts();
  const { exercises, primaryGroupsUk, musclesUk } = useExerciseCatalog();
  const { templates } = useWorkoutTemplates();
  const monthlyPlan = useMonthlyPlan();

  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    try {
      return localStorage.getItem(SELECTED_TEMPLATE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [planConfirmOpen, setPlanConfirmOpen] = useState(false);
  const [pendingPicks, setPendingPicks] = useState(null);
  const planConfirmRef = useRef(null);
  useDialogFocusTrap(planConfirmOpen, planConfirmRef, {
    onEscape: () => {
      setPlanConfirmOpen(false);
      setPendingPicks(null);
    },
  });

  useEffect(() => {
    if (selectedTemplateId) return;
    const first = templates[0]?.id;
    if (first) {
      setSelectedTemplateId(first);
      try {
        localStorage.setItem(SELECTED_TEMPLATE_KEY, first);
      } catch {}
    }
  }, [templates, selectedTemplateId]);

  const streakDays = (() => {
    const days = new Set(
      (workouts || [])
        .map((w) => (w.startedAt ? new Date(w.startedAt) : null))
        .filter(Boolean)
        .map((d) =>
          new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        ),
    );

    const now = new Date();
    let cur = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    let s = 0;
    const DAY = 24 * 60 * 60 * 1000;
    while (days.has(cur)) {
      s += 1;
      cur -= DAY;
    }
    return s;
  })();

  const statusByMuscle = (() => {
    const map = (id) => {
      if (!id) return null;
      if (id === "pectoralis_major" || id === "pectoralis_minor")
        return "chest";
      if (id === "latissimus_dorsi") return "upper-back";
      if (id === "rhomboids" || id === "upper_back") return "upper-back";
      if (id === "erector_spinae") return "lower-back";
      if (id === "trapezius") return "trapezius";
      if (id === "biceps") return "biceps";
      if (id === "triceps") return "triceps";
      if (id === "forearms") return "forearm";
      if (id === "front_deltoid") return "front-deltoids";
      if (id === "rear_deltoid") return "back-deltoids";
      if (id === "rectus_abdominis") return "abs";
      if (id === "obliques") return "obliques";
      if (id === "quadriceps") return "quadriceps";
      if (id === "hamstrings") return "hamstring";
      if (id === "calves") return "calves";
      if (id === "adductors") return "adductor";
      if (id === "abductors") return "abductors";
      if (id === "gluteus_maximus" || id === "gluteus_medius") return "gluteal";
      if (id === "neck") return "neck";
      return null;
    };
    const worst = (a, b) =>
      a === "red" || b === "red"
        ? "red"
        : a === "yellow" || b === "yellow"
          ? "yellow"
          : "green";
    const out = {};
    for (const m of Object.values(rec.by || {})) {
      const key = map(m.id);
      if (!key) continue;
      out[key] = out[key] ? worst(out[key], m.status) : m.status;
    }
    return out;
  })();

  const effectiveTemplateId = monthlyPlan.todayTemplateId || selectedTemplateId;

  const plan = useMemo(() => {
    const tpl = templates.find((t) => t.id === effectiveTemplateId);
    const picked = tpl
      ? tpl.exerciseIds
          .map((id) => exercises.find((e) => e.id === id))
          .filter(Boolean)
      : [];

    const focus = (rec.ready || []).slice(0, 4).map((m) => ({
      id: m.id,
      label: musclesUk?.[m.id] || m.label || m.id,
      daysSince: m.daysSince,
    }));
    const avoid = (rec.avoid || [])
      .slice(0, 4)
      .map((m) => ({ id: m.id, label: musclesUk?.[m.id] || m.label || m.id }));
    return { picked, focus, avoid, templateName: tpl?.name || "" };
  }, [
    effectiveTemplateId,
    templates,
    exercises,
    rec.ready,
    rec.avoid,
    musclesUk,
  ]);

  const dashMetrics = useMemo(
    () => ({
      total: completedWorkoutsCount(workouts),
      week: countCompletedInCurrentWeek(workouts),
      volume: totalCompletedVolumeKg(workouts),
      pr: personalRecordsExerciseCount(workouts),
    }),
    [workouts],
  );

  const monthCompletedCount = useMemo(() => {
    const now = new Date();
    return (workouts || []).filter((w) => {
      if (!w.endedAt) return false;
      const d = new Date(w.startedAt);
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    }).length;
  }, [workouts]);

  const avgDurationSec = useMemo(() => {
    const done = (workouts || []).filter((w) => w.endedAt);
    if (!done.length) return 0;
    const sum = done.reduce((s, w) => s + workoutDurationSec(w), 0);
    return Math.round(sum / done.length);
  }, [workouts]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Доброго ранку";
    if (hour < 18) return "Доброго дня";
    return "Доброго вечора";
  }, []);

  const startWorkoutFromPlan = (picks) => {
    const w = createWorkout();
    for (const ex of picks) {
      const isCardio = ex.primaryGroup === "cardio";
      addItem(w.id, {
        exerciseId: ex.id,
        nameUk: ex?.name?.uk || ex?.name?.en,
        primaryGroup: ex.primaryGroup,
        musclesPrimary: ex?.muscles?.primary || [],
        musclesSecondary: ex?.muscles?.secondary || [],
        type: isCardio ? "distance" : "strength",
        sets: isCardio ? undefined : [{ weightKg: 0, reps: 0 }],
        durationSec: 0,
        distanceM: isCardio ? 0 : 0,
      });
    }
    try {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, w.id);
    } catch {}
    try {
      sessionStorage.setItem("fizruk_workouts_mode", "log");
    } catch {}
    window.location.hash = "#workouts";
  };

  const tryStartPlan = (picks) => {
    if (!picks?.length) return;
    const risky = picks.some(
      (ex) => recoveryConflictsForExercise(ex, rec.by).hasWarning,
    );
    if (risky) {
      setPendingPicks(picks);
      setPlanConfirmOpen(true);
      return;
    }
    setPendingPicks(null);
    startWorkoutFromPlan(picks);
  };

  const kpi = [
    {
      id: "total",
      label: "Всього тренувань",
      value: String(dashMetrics.total),
      sub: "завершених",
      icon: "dumbbell",
    },
    {
      id: "week",
      label: "Цього тижня",
      value: String(dashMetrics.week),
      sub: streakDays > 0 ? `${streakDays} дн поспіль` : "поточний тиждень",
      icon: "flame",
    },
    {
      id: "vol",
      label: "Загальний обʼєм",
      value: `${formatCompactKg(dashMetrics.volume)}`,
      sub: "кг × повторення",
      icon: "chart",
    },
    {
      id: "pr",
      label: "Рекорди (вправи)",
      value: String(dashMetrics.pr),
      sub: "за оцінкою 1ПМ",
      icon: "trophy",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 fizruk-page-scroll-pad space-y-4">
        <section
          className="rounded-3xl p-6 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)",
          }}
          aria-label="Привітання"
        >
          <p className="text-[11px] font-bold tracking-widest uppercase text-accent">
            {greeting} · {today}
          </p>
          <h1 className="text-[26px] font-black text-white mt-3 leading-tight">
            Твій прогрес
            <br />
            зібраний в одному місці
          </h1>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/60">
                Тиждень
              </p>
              <p className="text-xl font-black text-white tabular-nums mt-1">
                {dashMetrics.week}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/60">
                Серія
              </p>
              <p className="text-xl font-black text-white tabular-nums mt-1">
                {streakDays}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/60">
                Сер. час
              </p>
              <p className="text-xl font-black text-white tabular-nums mt-1">
                {avgDurationSec ? formatDurShort(avgDurationSec) : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/60">
                Місяць
              </p>
              <p className="text-xl font-black text-white tabular-nums mt-1">
                {monthCompletedCount}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              className="w-full py-4 rounded-full font-bold text-[15px] bg-accent transition-all active:scale-[0.98]"
              style={{ color: "#0f2d1a" }}
              onClick={() => {
                try {
                  sessionStorage.setItem("fizruk_workouts_mode", "log");
                } catch {}
                window.location.hash = "#workouts";
              }}
              aria-label="Почати тренування"
            >
              Почати тренування
            </button>
            <button
              type="button"
              className="w-full py-4 rounded-full font-semibold text-[15px] text-white border border-white/25 transition-colors active:bg-white/10"
              onClick={() => {
                try {
                  sessionStorage.setItem("fizruk_workouts_mode", "templates");
                } catch {}
                window.location.hash = "#workouts";
              }}
              aria-label="Мої шаблони"
            >
              Мої шаблони
            </button>
          </div>
        </section>

        <section
          className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card"
          aria-label="Відновлення та фокус тренування"
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left flex items-start gap-2 rounded-xl -m-1 p-1 hover:bg-panelHi/80 transition-colors"
              onClick={() => setRecoveryOpen((o) => !o)}
              aria-expanded={recoveryOpen}
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-text">
                  Відновлення й фокус
                </h2>
                <p className="text-[11px] text-subtle mt-1 leading-snug">
                  Колір на силуеті — готовність груп; чіпи — пріоритет після
                  відпочинку.
                </p>
              </div>
              <span
                className="text-lg leading-none text-muted shrink-0 mt-0.5"
                aria-hidden
              >
                {recoveryOpen ? "▾" : "▸"}
              </span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 min-h-[40px] px-3 text-xs shrink-0"
              onClick={() => onOpenAtlas?.()}
              aria-label="Відкрити атлас мʼязів"
            >
              Атлас
            </Button>
          </div>

          {recoveryOpen && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-subtle mb-3 mt-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success" /> готово
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-warning" /> краще
                  почекати
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-danger" /> рано
                </span>
              </div>

              <BodyAtlas
                statusByMuscle={statusByMuscle}
                height={120}
                showLegend={false}
              />

              <div className="mt-4 pt-3 border-t border-line/60">
                <p className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                  Пріоритет після відпочинку
                </p>
                <div className="flex flex-wrap gap-2">
                  {(plan.focus || []).map((m) => (
                    <span
                      key={m.id}
                      className="px-2.5 py-1 bg-success/10 text-success text-xs rounded-full font-medium border border-success/15"
                    >
                      {m.label}
                      {m.daysSince == null ? "" : ` · ${m.daysSince}д без`}
                    </span>
                  ))}
                  {(plan.focus || []).length === 0 && (
                    <span className="text-xs text-subtle">
                      Додай завершені тренування — зʼявиться пріоритет груп.
                    </span>
                  )}
                </div>
                {(plan.avoid || []).length > 0 && (
                  <p className="text-xs text-muted mt-3 leading-relaxed">
                    <span className="font-semibold text-warning">
                      Почекати:
                    </span>{" "}
                    {plan.avoid.map((x) => x.label).join(", ")}
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          role="list"
          aria-label="Ключові показники"
        >
          {kpi.map((card) => (
            <div
              key={card.id}
              role="listitem"
              className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card min-h-[100px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-2xl font-extrabold text-text tabular-nums leading-none">
                    {card.value}
                  </div>
                  <div className="text-2xs font-semibold text-subtle uppercase tracking-wide mt-2">
                    {card.label}
                  </div>
                  <div className="text-[9px] text-muted mt-0.5 leading-snug">
                    {card.sub}
                  </div>
                </div>
                <div
                  className="shrink-0 w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success"
                  aria-hidden
                >
                  {card.icon === "dumbbell" && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
                    </svg>
                  )}
                  {card.icon === "flame" && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.5-.5-3-1.5-4.5 2 2.5 2.5 5 1.5 7.5-1 2.5-3 4-5.5 4-3 0-5-2.5-5-5.5 0-3 2-5.5 5-7 0 3 1 5.5 3 7.5z" />
                    </svg>
                  )}
                  {card.icon === "chart" && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 3v18h18" />
                      <path d="M7 12l4-4 4 4 5-6" />
                    </svg>
                  )}
                  {card.icon === "trophy" && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
                      <path d="M7 8H5a2 2 0 0 1-2-2V4h4M17 8h2a2 2 0 0 0 2-2V4h-4" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-medium text-subtle">
              План на сьогодні
            </div>
            <button
              type="button"
              className="text-[11px] font-semibold text-primary hover:underline shrink-0"
              onClick={() => {
                window.location.hash = "#plan";
              }}
            >
              Календар
            </button>
          </div>
          {monthlyPlan.todayTemplateId && (
            <p className="text-[11px] text-success/90 mb-2">
              Шаблон з місячного плану на сьогодні.
            </p>
          )}
          <div className="rounded-2xl border border-line bg-panelHi px-3">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">
              Мій шаблон
            </div>
            <select
              className="w-full min-h-[44px] bg-transparent text-sm text-text outline-none"
              value={selectedTemplateId}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedTemplateId(v);
                try {
                  localStorage.setItem(SELECTED_TEMPLATE_KEY, v);
                } catch {}
              }}
              aria-label="Обрати збережений шаблон тренування"
            >
              {templates.length === 0 ? (
                <option value="">— немає шаблонів —</option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {templates.length === 0 && (
            <div className="mt-3 text-sm text-subtle text-center py-2">
              Створи шаблон у розділі{" "}
              <button
                type="button"
                className="font-semibold text-text underline"
                onClick={() => {
                  try {
                    sessionStorage.setItem("fizruk_workouts_mode", "templates");
                  } catch {}
                  window.location.hash = "#workouts";
                }}
              >
                Тренування → Шаблони
              </button>
            </div>
          )}

          {!workouts?.length ? (
            <div className="text-sm text-subtle text-center py-4">
              Додай перше тренування, щоб статистика була точнішою
            </div>
          ) : null}

          <div className="mt-4">
            <div className="text-xs text-subtle mb-2">
              Вправи з шаблону
              {plan.templateName ? ` «${plan.templateName}»` : ""}:
            </div>
            {plan.picked.length ? (
              <div className="space-y-2">
                {plan.picked.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="w-full text-left border border-line rounded-2xl p-3 min-h-[44px] bg-bg hover:bg-panelHi transition-colors"
                    onClick={() => {
                      window.location.hash = `#exercise/${ex.id}`;
                    }}
                  >
                    <div className="text-sm font-semibold text-text truncate">
                      {ex?.name?.uk || ex?.name?.en}
                    </div>
                    <div className="text-xs text-subtle mt-0.5">
                      {primaryGroupsUk?.[ex.primaryGroup] || ex.primaryGroup}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-subtle text-center py-6">
                {templates.length
                  ? "У шаблоні немає вправ або вправи видалені з каталогу"
                  : "Обери або створи шаблон"}
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1 h-12 min-h-[44px]"
              onClick={() => tryStartPlan(plan.picked)}
              disabled={!plan.picked.length}
            >
              Стартувати тренування
            </Button>
            <Button
              variant="ghost"
              className="h-12 min-h-[44px] px-4"
              onClick={() => {
                window.location.hash = "#workouts";
              }}
            >
              Журнал
            </Button>
          </div>
        </div>
      </div>

      {planConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center fizruk-sheet"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрити"
            onClick={() => {
              setPlanConfirmOpen(false);
              setPendingPicks(null);
            }}
          />
          <div
            ref={planConfirmRef}
            className="relative w-full max-w-4xl bg-panel border-t border-line rounded-t-3xl p-5 shadow-soft fizruk-sheet-pad"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-confirm-title"
          >
            <div
              id="plan-confirm-title"
              className="text-lg font-extrabold text-text"
            >
              Увага
            </div>
            <p className="text-sm text-subtle mt-2 leading-relaxed">
              У цьому шаблоні є вправи на мʼязи, які ще відновлюються.
              Продовжити старт тренування?
            </p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="ghost"
                className="flex-1 h-12 min-h-[44px]"
                onClick={() => {
                  setPlanConfirmOpen(false);
                  setPendingPicks(null);
                }}
              >
                Скасувати
              </Button>
              <Button
                className="flex-1 h-12 min-h-[44px]"
                onClick={() => {
                  const picks = pendingPicks?.length
                    ? pendingPicks
                    : plan.picked;
                  setPlanConfirmOpen(false);
                  setPendingPicks(null);
                  startWorkoutFromPlan(picks);
                }}
              >
                Продовжити
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
