import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { Sheet } from "@shared/components/ui/Sheet";
import { useEffect, useMemo, useState } from "react";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useWorkouts } from "../hooks/useWorkouts";
import { useMonthlyPlan } from "../hooks/useMonthlyPlan";
import { BodyAtlas } from "../components/BodyAtlas";
import { recoveryConflictsForExercise } from "../lib/recoveryConflict";
import { workoutDurationSec } from "../lib/workoutStats";
import { ACTIVE_WORKOUT_KEY } from "../lib/workoutUi";
import { Card } from "@shared/components/ui/Card";

const SELECTED_TEMPLATE_KEY = "fizruk_selected_template_id_v1";

export function Dashboard({
  onOpenAtlas,
  onOpenPrograms,
  activeProgram,
  todaySession,
  onStartProgramWorkout,
}) {
  const today = new Date().toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const rec = useRecovery();
  const { workouts, createWorkout, addItem } = useWorkouts();
  const { exercises, primaryGroupsUk, musclesUk } = useExerciseCatalog();
  const { templates, recentlyUsed, markTemplateUsed } = useWorkoutTemplates();
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

  const closePlanConfirm = () => {
    setPlanConfirmOpen(false);
    setPendingPicks(null);
  };

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

  const startWorkoutFromPlan = (picks, templateId) => {
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
    if (templateId) markTemplateUsed(templateId);
    try {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, w.id);
    } catch {}
    try {
      sessionStorage.setItem("fizruk_workouts_mode", "log");
    } catch {}
    window.location.hash = "#workouts";
  };

  const [pendingTemplateId, setPendingTemplateId] = useState(null);

  const tryStartPlan = (picks: unknown[], templateId?: string | null) => {
    if (!picks?.length) return;
    const risky = picks.some(
      (ex) => recoveryConflictsForExercise(ex, rec.by).hasWarning,
    );
    if (risky) {
      setPendingPicks(picks);
      setPendingTemplateId(templateId || null);
      setPlanConfirmOpen(true);
      return;
    }
    setPendingPicks(null);
    setPendingTemplateId(null);
    startWorkoutFromPlan(picks, templateId);
  };

  const primaryAction = useMemo(() => {
    if (activeProgram && todaySession) {
      const session = activeProgram.sessions?.[todaySession.sessionKey];
      if (session) {
        return {
          kind: "program" as const,
          label: todaySession.name,
          hint: activeProgram.name,
          exerciseCount: (session.exerciseIds || []).length,
          sessionKey: todaySession.sessionKey,
        };
      }
    }
    const fallbackTemplateId =
      monthlyPlan.todayTemplateId ||
      recentlyUsed[0]?.id ||
      templates[0]?.id ||
      null;
    if (fallbackTemplateId) {
      const tpl = templates.find((t) => t.id === fallbackTemplateId);
      if (tpl) {
        const picks = (tpl.exerciseIds || [])
          .map((id) => exercises.find((e) => e.id === id))
          .filter(Boolean);
        if (picks.length > 0) {
          let hint: string | null = null;
          if (monthlyPlan.todayTemplateId === tpl.id) {
            hint = "З місячного плану";
          } else if (recentlyUsed[0]?.id === tpl.id) {
            hint = "Останнє тренування";
          }
          return {
            kind: "template" as const,
            label: tpl.name,
            hint,
            exerciseCount: picks.length,
            templateId: tpl.id,
            picks,
          };
        }
      }
    }
    return null;
  }, [
    activeProgram,
    todaySession,
    monthlyPlan.todayTemplateId,
    recentlyUsed,
    templates,
    exercises,
  ]);

  // Rule 5.3: primitive result + trivial arithmetic → no useMemo needed.
  const estimatedDurationMin = !primaryAction?.exerciseCount
    ? null
    : avgDurationSec > 300
      ? Math.max(10, Math.round(avgDurationSec / 60 / 5) * 5)
      : Math.max(10, primaryAction.exerciseCount * 8);

  const handleStartPrimary = () => {
    if (!primaryAction) return;
    if (primaryAction.kind === "program") {
      const session = activeProgram?.sessions?.[primaryAction.sessionKey];
      if (session && onStartProgramWorkout) {
        onStartProgramWorkout(session, activeProgram);
      }
      return;
    }
    tryStartPlan(primaryAction.picks, primaryAction.templateId);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <section
          className="rounded-3xl p-6 overflow-hidden bg-hero-teal"
          aria-label="Привітання"
        >
          {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift --
              Branded fizruk hero kicker above h1 — dynamic greeting string. */}
          <p className="text-xs font-bold tracking-widest uppercase text-fizruk">
            {greeting} · {today}
          </p>
          <h1 className="text-hero font-black text-white mt-3 leading-tight">
            Твій прогрес
            <br />
            зібраний в одному місці
          </h1>
          <div className="mt-6 flex flex-col gap-3">
            {primaryAction ? (
              <button
                type="button"
                className="w-full py-4 px-5 rounded-2xl bg-fizruk-strong text-white transition-all active:scale-[0.98] flex items-center gap-3 text-left"
                onClick={handleStartPrimary}
                aria-label={`Почати: ${primaryAction.label}`}
              >
                <span
                  className="shrink-0 w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"
                  aria-hidden
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <SectionHeading
                    as="span"
                    size="xs"
                    className="block text-white/70"
                  >
                    Почати
                  </SectionHeading>
                  <span className="block text-base font-black truncate leading-tight">
                    {primaryAction.label}
                  </span>
                  <span className="block text-2xs text-white/70 mt-0.5 truncate">
                    {primaryAction.exerciseCount} вправ
                    {estimatedDurationMin
                      ? ` · ~${estimatedDurationMin} хв`
                      : ""}
                    {primaryAction.hint ? ` · ${primaryAction.hint}` : ""}
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="w-full py-4 rounded-full font-bold text-base bg-fizruk-strong text-white transition-all active:scale-[0.98]"
                onClick={() => {
                  try {
                    sessionStorage.setItem("fizruk_workouts_mode", "templates");
                  } catch {}
                  window.location.hash = "#workouts";
                }}
                aria-label="Створити перший шаблон"
              >
                Створити перший шаблон
              </button>
            )}
            <button
              type="button"
              className="w-full py-4 rounded-full font-semibold text-base text-white border border-white/25 transition-colors active:bg-white/10"
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

        {templates.length > 0 &&
          (() => {
            const quickTemplates =
              recentlyUsed.length > 0 ? recentlyUsed : templates.slice(0, 3);
            return (
              <Card as="section" radius="lg" aria-label="Швидкий старт">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <SectionHeading as="h2" size="sm">
                    Швидкий старт
                  </SectionHeading>
                  <span className="text-2xs text-muted">
                    {recentlyUsed.length > 0
                      ? "Нещодавно використані"
                      : "Останні шаблони"}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {quickTemplates.map((tpl) => {
                    const picks = (tpl.exerciseIds || [])
                      .map((id) => exercises.find((e) => e.id === id))
                      .filter(Boolean);
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        className="w-full text-left flex items-center gap-3 rounded-2xl border border-line bg-bg hover:bg-panelHi p-3 min-h-[52px] transition-colors active:scale-[0.99]"
                        onClick={() => tryStartPlan(picks, tpl.id)}
                        disabled={!picks.length}
                      >
                        <div
                          className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0"
                          aria-hidden
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-text truncate">
                            {tpl.name}
                          </div>
                          <div className="text-xs text-subtle mt-0.5">
                            {picks.length > 0
                              ? `${picks.length} вправ`
                              : "Немає вправ у каталозі"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

        {activeProgram && (
          <Card as="section" radius="lg" aria-label="Програма сьогодні">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <SectionHeading as="h2" size="sm">
                  Програма: {activeProgram.name}
                </SectionHeading>
                {todaySession ? (
                  <p className="text-sm font-semibold text-text mt-0.5">
                    {todaySession.name}
                  </p>
                ) : (
                  <p className="text-sm text-subtle mt-0.5">
                    Сьогодні відпочинок 💤
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-success hover:underline shrink-0"
                onClick={() => onOpenPrograms?.()}
              >
                Програми →
              </button>
            </div>
            {todaySession && (
              <button
                type="button"
                className="w-full py-3 rounded-xl bg-fizruk text-white font-semibold text-sm transition-all active:scale-[0.98]"
                onClick={() => {
                  const session =
                    activeProgram.sessions?.[todaySession.sessionKey];
                  if (session && onStartProgramWorkout) {
                    onStartProgramWorkout(session, activeProgram);
                  }
                }}
              >
                Розпочати тренування за програмою
              </button>
            )}
          </Card>
        )}

        <Card
          as="section"
          radius="lg"
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
                <p className="text-xs text-subtle mt-1 leading-snug">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-subtle mb-3 mt-3">
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

              {rec.wellbeingMult > 1.1 && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-warning/10 border border-warning/25 flex items-start gap-2">
                  <span className="text-base shrink-0" aria-hidden>
                    😴
                  </span>
                  <p className="text-xs text-warning leading-snug">
                    {rec.wellbeingMult >= 1.3
                      ? "Поганий сон або дуже низька енергія — відновлення значно сповільнене."
                      : "Недостатній сон або низька енергія — відновлення сповільнене."}{" "}
                    М{"'"}язи потребують більше часу перед наступним
                    навантаженням.
                  </p>
                </div>
              )}

              <BodyAtlas
                statusByMuscle={statusByMuscle}
                height={120}
                showLegend={false}
              />

              <div className="mt-4 pt-3 border-t border-line">
                <SectionHeading as="p" size="xs" className="mb-2">
                  Пріоритет після відпочинку
                </SectionHeading>
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
        </Card>

        <Card radius="lg" padding="lg">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-medium text-subtle">
              План на сьогодні
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline shrink-0"
              onClick={() => {
                window.location.hash = "#plan";
              }}
            >
              Календар
            </button>
          </div>
          {monthlyPlan.todayTemplateId && (
            <p className="text-xs text-success/90 mb-2">
              Шаблон з місячного плану на сьогодні.
            </p>
          )}
          <div className="rounded-2xl border border-line bg-panelHi px-3">
            <SectionHeading as="div" size="xs" className="pt-2">
              Мій шаблон
            </SectionHeading>
            <select
              className="input-focus-fizruk w-full min-h-[44px] bg-transparent text-sm text-text rounded-xl"
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
        </Card>
      </div>

      <Sheet
        open={planConfirmOpen}
        onClose={closePlanConfirm}
        title="Увага"
        panelClassName="fizruk-sheet max-w-4xl"
        zIndex={100}
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 h-12 min-h-[44px]"
              onClick={closePlanConfirm}
            >
              Скасувати
            </Button>
            <Button
              className="flex-1 h-12 min-h-[44px]"
              onClick={() => {
                const picks = pendingPicks?.length ? pendingPicks : plan.picked;
                closePlanConfirm();
                startWorkoutFromPlan(picks, pendingTemplateId);
                setPendingTemplateId(null);
              }}
            >
              Продовжити
            </Button>
          </div>
        }
      >
        <p className="text-sm text-subtle leading-relaxed">
          У цьому шаблоні є вправи на мʼязи, які ще відновлюються. Продовжити
          старт тренування?
        </p>
      </Sheet>
    </div>
  );
}
