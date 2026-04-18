import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import {
  aggregateFinyk,
  aggregateFizruk,
  aggregateNutrition,
  aggregateRoutine,
} from "./useWeeklyDigest.js";

// Duration per story slide in ms. Slightly longer than Instagram's ~5s because
// we're showing denser numeric content, not photos.
const SLIDE_MS = 6500;
// Tick cadence for the progress bar; 50ms keeps the bar smooth without
// running the timer hot.
const TICK_MS = 50;
// Minimum vertical drag (px) required to trigger close-on-swipe-down.
const SWIPE_CLOSE_THRESHOLD = 80;

const CURRENCY = new Intl.NumberFormat("uk-UA", {
  style: "decimal",
  maximumFractionDigits: 0,
});

function fmtUah(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${CURRENCY.format(Math.round(v))} грн`;
}

function fmtNum(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return CURRENCY.format(Math.round(v));
}

const BG_GRADIENTS = {
  intro:
    "from-brand-500 via-brand-400 to-teal-400 dark:from-brand-700 dark:via-brand-600 dark:to-teal-600",
  finyk:
    "from-brand-600 via-brand-500 to-indigo-400 dark:from-brand-800 dark:via-brand-700 dark:to-indigo-700",
  fizruk:
    "from-teal-500 via-teal-400 to-cyan-400 dark:from-teal-700 dark:via-teal-600 dark:to-cyan-700",
  nutrition:
    "from-lime-500 via-lime-400 to-emerald-400 dark:from-lime-700 dark:via-lime-600 dark:to-emerald-700",
  routine:
    "from-coral-500 via-coral-400 to-rose-400 dark:from-coral-700 dark:via-coral-600 dark:to-rose-700",
  overall:
    "from-amber-500 via-orange-400 to-coral-400 dark:from-amber-700 dark:via-orange-600 dark:to-coral-700",
};

function buildSlides(digest, weekKey, weekRange) {
  const slides = [
    {
      id: "intro",
      kind: "intro",
      label: "Тиждень",
      bg: BG_GRADIENTS.intro,
    },
  ];

  const finykAgg = aggregateFinyk(weekKey);
  if (digest?.finyk || (finykAgg && finykAgg.txCount > 0)) {
    slides.push({
      id: "finyk",
      kind: "finyk",
      label: "Фінанси",
      bg: BG_GRADIENTS.finyk,
      agg: finykAgg,
      ai: digest?.finyk ?? null,
    });
  }

  const fizrukAgg = aggregateFizruk(weekKey);
  if (digest?.fizruk || (fizrukAgg && fizrukAgg.workoutsCount > 0)) {
    slides.push({
      id: "fizruk",
      kind: "fizruk",
      label: "Тренування",
      bg: BG_GRADIENTS.fizruk,
      agg: fizrukAgg,
      ai: digest?.fizruk ?? null,
    });
  }

  const nutritionAgg = aggregateNutrition(weekKey);
  if (digest?.nutrition || (nutritionAgg && nutritionAgg.daysLogged > 0)) {
    slides.push({
      id: "nutrition",
      kind: "nutrition",
      label: "Харчування",
      bg: BG_GRADIENTS.nutrition,
      agg: nutritionAgg,
      ai: digest?.nutrition ?? null,
    });
  }

  const routineAgg = aggregateRoutine(weekKey);
  if (digest?.routine || (routineAgg && routineAgg.habitCount > 0)) {
    slides.push({
      id: "routine",
      kind: "routine",
      label: "Звички",
      bg: BG_GRADIENTS.routine,
      agg: routineAgg,
      ai: digest?.routine ?? null,
    });
  }

  if (
    Array.isArray(digest?.overallRecommendations) &&
    digest.overallRecommendations.length > 0
  ) {
    slides.push({
      id: "overall",
      kind: "overall",
      label: "Підсумок",
      bg: BG_GRADIENTS.overall,
      recommendations: digest.overallRecommendations,
    });
  }

  // Carry week metadata on every slide for header rendering.
  return slides.map((s) => ({ ...s, weekRange }));
}

function StoryShell({ slide, children }) {
  return (
    <div
      className={cn("absolute inset-0 bg-gradient-to-br text-white", slide.bg)}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.25),transparent_60%)]" />
      <div className="relative h-full w-full flex flex-col px-6 pt-24 pb-16 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function StatRow({ label, value, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/10 last:border-b-0">
      <span className="text-[13px] uppercase tracking-wide text-white/70 font-semibold">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-bold tabular-nums",
          accent ? "text-white" : "text-white/95",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function IntroSlide({ slide }) {
  return (
    <StoryShell slide={slide}>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-[12px] uppercase tracking-[0.3em] text-white/70 font-bold mb-3">
          Щотижневий дайджест
        </p>
        <h2 className="text-[40px] leading-[1.05] font-black mb-4">
          Твій тиждень
        </h2>
        <p className="text-[15px] text-white/85 leading-relaxed max-w-[22rem]">
          Коротке зведення по всіх модулях. Тапай праворуч, щоб гортати далі,
          ліворуч — назад. Утримуй, щоб зупинити.
        </p>
      </div>
      <div className="text-[13px] font-semibold text-white/85">
        {slide.weekRange}
      </div>
    </StoryShell>
  );
}

function FinykSlide({ slide }) {
  const { agg, ai } = slide;
  const net = (agg?.totalIncome ?? 0) - (agg?.totalSpent ?? 0);
  const topCats = Array.isArray(agg?.topCategories)
    ? agg.topCategories.slice(0, 3)
    : [];
  const maxCat = topCats[0]?.amount || 1;

  return (
    <StoryShell slide={slide}>
      <p className="text-[12px] uppercase tracking-[0.3em] text-white/70 font-bold mb-2">
        Фінанси · ФІНІК
      </p>
      <div className="mb-6">
        <div className="text-[12px] text-white/70 font-semibold">
          Витрати тижня
        </div>
        <div className="text-[44px] leading-none font-black tabular-nums mt-1">
          {fmtUah(agg?.totalSpent)}
        </div>
        <div className="mt-2 text-[13px] text-white/80">
          {agg?.txCount || 0} транзакцій · дохід {fmtUah(agg?.totalIncome)}
        </div>
      </div>

      {topCats.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-white/75 font-bold">
            Куди пішли гроші
          </p>
          {topCats.map((c) => {
            const pct = Math.max(6, Math.round((c.amount / maxCat) * 100));
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold text-white/95 truncate pr-2">
                    {c.name}
                  </span>
                  <span className="tabular-nums font-bold">
                    {fmtUah(c.amount)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-4">
        <StatRow
          label="Чистий потік"
          value={`${net >= 0 ? "+" : "−"}${fmtUah(Math.abs(net))}`}
          accent
        />
      </div>

      {ai?.summary && (
        <div className="mt-auto rounded-2xl bg-white/15 backdrop-blur-sm px-4 py-3 border border-white/20">
          <p className="text-[14px] font-semibold leading-snug">{ai.summary}</p>
          {ai.comment && (
            <p className="text-[12.5px] text-white/85 mt-2 leading-relaxed">
              {ai.comment}
            </p>
          )}
        </div>
      )}
    </StoryShell>
  );
}

function FizrukSlide({ slide }) {
  const { agg, ai } = slide;
  const topEx = Array.isArray(agg?.topExercises)
    ? agg.topExercises.slice(0, 3)
    : [];

  return (
    <StoryShell slide={slide}>
      <p className="text-[12px] uppercase tracking-[0.3em] text-white/70 font-bold mb-2">
        Тренування · ФІЗРУК
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-white/15 border border-white/20 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-white/75 font-bold">
            Тренувань
          </div>
          <div className="text-[36px] leading-none font-black tabular-nums mt-1">
            {agg?.workoutsCount ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-white/15 border border-white/20 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-white/75 font-bold">
            Обсяг, кг
          </div>
          <div className="text-[36px] leading-none font-black tabular-nums mt-1">
            {fmtNum(agg?.totalVolume)}
          </div>
        </div>
      </div>

      {topEx.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wider text-white/75 font-bold mb-2">
            Головні вправи
          </p>
          <div className="space-y-1">
            {topEx.map((e) => (
              <StatRow
                key={e.name}
                label={e.name}
                value={`${fmtNum(e.totalVolume)} кг`}
              />
            ))}
          </div>
        </div>
      )}

      {agg?.recoveryLabel && (
        <div className="mt-2 inline-flex self-start px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-[12px] font-semibold">
          {agg.recoveryLabel}
        </div>
      )}

      {ai?.summary && (
        <div className="mt-auto rounded-2xl bg-white/15 backdrop-blur-sm px-4 py-3 border border-white/20">
          <p className="text-[14px] font-semibold leading-snug">{ai.summary}</p>
          {ai.comment && (
            <p className="text-[12.5px] text-white/85 mt-2 leading-relaxed">
              {ai.comment}
            </p>
          )}
        </div>
      )}
    </StoryShell>
  );
}

function NutritionSlide({ slide }) {
  const { agg, ai } = slide;
  const kcalPct =
    agg?.targetKcal && agg.targetKcal > 0
      ? Math.min(
          140,
          Math.max(0, Math.round((agg.avgKcal / agg.targetKcal) * 100)),
        )
      : 0;

  return (
    <StoryShell slide={slide}>
      <p className="text-[12px] uppercase tracking-[0.3em] text-white/70 font-bold mb-2">
        Харчування
      </p>

      <div className="mb-5">
        <div className="text-[12px] text-white/75 font-semibold">
          Середнє калорій/день
        </div>
        <div className="flex items-baseline gap-3 mt-1">
          <div className="text-[44px] leading-none font-black tabular-nums">
            {fmtNum(agg?.avgKcal)}
          </div>
          <div className="text-[14px] text-white/80 font-semibold">
            / {fmtNum(agg?.targetKcal)}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-white rounded-full"
            style={{ width: `${Math.min(100, kcalPct)}%` }}
          />
        </div>
        <div className="text-[11px] text-white/75 mt-1">
          {kcalPct}% від цілі · залоговано {agg?.daysLogged ?? 0} / 7 днів
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/75 font-bold">
            Білки
          </div>
          <div className="text-[20px] font-black tabular-nums mt-0.5">
            {fmtNum(agg?.avgProtein)}г
          </div>
        </div>
        <div className="rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/75 font-bold">
            Жири
          </div>
          <div className="text-[20px] font-black tabular-nums mt-0.5">
            {fmtNum(agg?.avgFat)}г
          </div>
        </div>
        <div className="rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/75 font-bold">
            Вугл.
          </div>
          <div className="text-[20px] font-black tabular-nums mt-0.5">
            {fmtNum(agg?.avgCarbs)}г
          </div>
        </div>
      </div>

      {ai?.summary && (
        <div className="mt-auto rounded-2xl bg-white/15 backdrop-blur-sm px-4 py-3 border border-white/20">
          <p className="text-[14px] font-semibold leading-snug">{ai.summary}</p>
          {ai.comment && (
            <p className="text-[12.5px] text-white/85 mt-2 leading-relaxed">
              {ai.comment}
            </p>
          )}
        </div>
      )}
    </StoryShell>
  );
}

function RoutineSlide({ slide }) {
  const { agg, ai } = slide;
  const sorted = Array.isArray(agg?.habits)
    ? [...agg.habits].sort((a, b) => b.completionRate - a.completionRate)
    : [];
  const top = sorted.slice(0, 3);

  return (
    <StoryShell slide={slide}>
      <p className="text-[12px] uppercase tracking-[0.3em] text-white/70 font-bold mb-2">
        Звички · Рутина
      </p>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative w-[104px] h-[104px]">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="3.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeDasharray={`${Math.min(100, agg?.overallRate ?? 0)}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[28px] font-black leading-none tabular-nums">
              {agg?.overallRate ?? 0}%
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/75 mt-0.5">
              виконано
            </div>
          </div>
        </div>
        <div>
          <div className="text-[12px] uppercase tracking-wider text-white/75 font-bold">
            Активних звичок
          </div>
          <div className="text-[32px] font-black leading-tight tabular-nums">
            {agg?.habitCount ?? 0}
          </div>
        </div>
      </div>

      {top.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-white/75 font-bold">
            Топ-звички
          </p>
          {top.map((h) => (
            <div key={h.name} className="space-y-1">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold text-white/95 truncate pr-2">
                  {h.name}
                </span>
                <span className="tabular-nums font-bold">
                  {h.done}/{h.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${h.completionRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {ai?.summary && (
        <div className="mt-auto rounded-2xl bg-white/15 backdrop-blur-sm px-4 py-3 border border-white/20">
          <p className="text-[14px] font-semibold leading-snug">{ai.summary}</p>
          {ai.comment && (
            <p className="text-[12.5px] text-white/85 mt-2 leading-relaxed">
              {ai.comment}
            </p>
          )}
        </div>
      )}
    </StoryShell>
  );
}

function OverallSlide({ slide }) {
  return (
    <StoryShell slide={slide}>
      <p className="text-[12px] uppercase tracking-[0.3em] text-white/75 font-bold mb-2">
        Підсумок тижня
      </p>
      <h2 className="text-[30px] leading-[1.1] font-black mb-5">
        Що робити далі
      </h2>
      <div className="space-y-3">
        {slide.recommendations.map((rec, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-2xl bg-white/15 border border-white/20 px-4 py-3"
          >
            <div className="shrink-0 w-7 h-7 rounded-full bg-white text-amber-600 flex items-center justify-center font-black text-[13px]">
              {i + 1}
            </div>
            <p className="text-[14px] leading-relaxed font-medium text-white">
              {rec}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[12px] text-white/80 pt-6">
        Тап праворуч, щоб закрити
      </div>
    </StoryShell>
  );
}

function renderSlide(slide) {
  switch (slide.kind) {
    case "intro":
      return <IntroSlide slide={slide} />;
    case "finyk":
      return <FinykSlide slide={slide} />;
    case "fizruk":
      return <FizrukSlide slide={slide} />;
    case "nutrition":
      return <NutritionSlide slide={slide} />;
    case "routine":
      return <RoutineSlide slide={slide} />;
    case "overall":
      return <OverallSlide slide={slide} />;
    default:
      return null;
  }
}

export function WeeklyDigestStories({ digest, weekKey, weekRange, onClose }) {
  const slides = useMemo(
    () => buildSlides(digest, weekKey, weekRange),
    [digest, weekKey, weekRange],
  );
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdTimerRef = useRef(null);
  const touchStartRef = useRef(null);
  const dragYRef = useRef(0);
  const containerRef = useRef(null);
  // Mirror of `index` and `progress` kept in refs so the navigation helpers
  // and the auto-advance timer can read/update them without stuffing side
  // effects into `setState` updaters (React requires updater fns to be pure).
  const indexRef = useRef(0);
  const progressRef = useRef(0);

  const clampedIndex = Math.min(index, Math.max(0, slides.length - 1));

  const next = useCallback(() => {
    const cur = indexRef.current;
    if (cur >= slides.length - 1) {
      onClose?.();
      return;
    }
    indexRef.current = cur + 1;
    progressRef.current = 0;
    setIndex(cur + 1);
    setProgress(0);
  }, [slides.length, onClose]);

  const prev = useCallback(() => {
    const target = Math.max(0, indexRef.current - 1);
    indexRef.current = target;
    progressRef.current = 0;
    setIndex(target);
    setProgress(0);
  }, []);

  // Auto-advance timer — ticks TICK_MS at a time so we can render a smooth
  // progress bar and also react to pause state mid-slide. Progress is tracked
  // in a ref so the interval can advance and call `next()` directly rather
  // than scheduling a side effect from inside a setState updater.
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const nextP = progressRef.current + (TICK_MS / SLIDE_MS) * 100;
      if (nextP >= 100) {
        progressRef.current = 0;
        setProgress(0);
        next();
      } else {
        progressRef.current = nextP;
        setProgress(nextP);
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [paused, clampedIndex, next]);

  // Keyboard nav + lock body scroll while open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  const handlePressStart = (e) => {
    // Press-and-hold pauses progress after ~180ms — a quick tap still
    // registers as a navigation click.
    holdTimerRef.current = setTimeout(() => {
      setPaused(true);
      holdTimerRef.current = null;
    }, 180);
    const touch = e.touches?.[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      dragYRef.current = 0;
    }
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    const dy = touch.clientY - touchStartRef.current.y;
    if (dy > 0) {
      dragYRef.current = dy;
      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(${Math.min(dy, 260)}px)`;
        containerRef.current.style.opacity = String(
          Math.max(0.4, 1 - dy / 400),
        );
      }
    }
  };

  const resetDrag = () => {
    if (containerRef.current) {
      containerRef.current.style.transform = "";
      containerRef.current.style.opacity = "";
    }
    dragYRef.current = 0;
    touchStartRef.current = null;
  };

  const handlePressEnd = (e) => {
    const wasHeld = holdTimerRef.current === null;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // Swipe-down-to-close wins over everything else: normal swipe gestures
    // run 200–500ms and would otherwise be swallowed by the hold guard below.
    if (dragYRef.current > SWIPE_CLOSE_THRESHOLD) {
      if (paused) setPaused(false);
      resetDrag();
      onClose?.();
      return;
    }
    // If the press was long enough for the hold-timer to fire, the user meant
    // to pause — releasing should only resume, not also advance the slide.
    if (paused || wasHeld) {
      if (paused) setPaused(false);
      resetDrag();
      return;
    }
    resetDrag();

    // Tap navigation — left third = prev, right two-thirds = next. Skip if
    // the user clicked on an interactive element (close button).
    const target = e.target;
    if (target?.closest?.("[data-story-ui]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x =
      (e.changedTouches?.[0]?.clientX ?? e.clientX ?? rect.left) - rect.left;
    if (x < rect.width / 3) prev();
    else next();
  };

  if (!slides.length) return null;
  const slide = slides[clampedIndex];

  return (
    <div
      className="fixed inset-0 z-[600] select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Щотижневий дайджест — сторіс"
    >
      <div className="absolute inset-0 bg-black/90" />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions --
          Mouse/touch handlers provide tap-to-navigate and press-to-pause on
          this fullscreen surface. Keyboard navigation (Arrow keys, Space,
          Escape) is wired up at the window level via the effect above, and a
          visible close button supplies the focus-reachable escape hatch. */}
      <div
        ref={containerRef}
        className="absolute inset-0 transition-[transform,opacity] duration-150 ease-out"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={() => {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          // Unconditional — `paused` may be stale in this closure if the
          // hold-timer just fired, and we must not leave the stories stuck.
          setPaused(false);
          resetDrag();
        }}
        onTouchStart={handlePressStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handlePressEnd}
      >
        {renderSlide(slide)}

        {/* Top chrome: progress bars + header */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions --
            Stops pointer events from bubbling to the parent navigation surface
            so that interactions with the progress bar / close button don't
            trigger tap-to-advance. */}
        <div
          data-story-ui
          className="absolute inset-x-0 top-0 px-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-2"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            {slides.map((s, i) => {
              const fill =
                i < clampedIndex ? 100 : i === clampedIndex ? progress : 0;
              return (
                <div
                  key={s.id}
                  className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden"
                >
                  <div
                    className="h-full bg-white rounded-full"
                    style={{
                      width: `${fill}%`,
                      transition:
                        i === clampedIndex && !paused
                          ? `width ${TICK_MS}ms linear`
                          : "none",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-[13px]">
              📊
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">
                Дайджест · {slide.label}
              </div>
              <div className="text-[10.5px] text-white/75 truncate">
                {weekRange}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              aria-label="Закрити"
              className="w-9 h-9 rounded-full bg-white/15 border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <Icon name="close" size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Invisible nav hints on sides for clarity on first view. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/10 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-black/10 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
