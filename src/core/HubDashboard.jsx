import { useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { HubRecommendations } from "./HubRecommendations.jsx";

function safeParseLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function txDateKey(tx) {
  if (!tx?.time) return null;
  return tx.time > 1e10
    ? localDateKey(new Date(tx.time))
    : localDateKey(new Date(tx.time * 1000));
}

function useFinykMetrics() {
  return useMemo(() => {
    const txList = safeParseLS("finyk_tx_cache", []);
    const today = localDateKey();
    let todaySpent = 0;
    let todayIncome = 0;
    const txCategories = safeParseLS("finyk_tx_cats", {});
    const hiddenIds = safeParseLS("finyk_hidden_txs", []);
    const hiddenSet = new Set(Array.isArray(hiddenIds) ? hiddenIds : []);
    const transferIds = new Set(
      Object.entries(txCategories)
        .filter(([, v]) => v === "internal_transfer")
        .map(([k]) => k)
    );

    if (Array.isArray(txList)) {
      for (const tx of txList) {
        const dk = txDateKey(tx);
        if (dk !== today) continue;
        if (hiddenSet.has(tx.id)) continue;
        if (transferIds.has(tx.id)) continue;
        const amount = (tx.amount ?? 0) / 100;
        if (amount < 0) todaySpent += Math.abs(amount);
        else todayIncome += amount;
      }
    }

    const rawInfo = safeParseLS("finyk_info_cache", null);
    const info = rawInfo?.info ?? rawInfo;
    const totalBalance = Array.isArray(info?.accounts)
      ? info.accounts.reduce((s, a) => s + (a.balance ?? 0), 0) / 100
      : null;

    return { todaySpent, todayIncome, totalBalance };
  }, []);
}

function computeRecoveryStatus(workouts) {
  const completed = Array.isArray(workouts)
    ? workouts.filter((w) => w.endedAt)
    : [];
  if (!completed.length) return { label: "Немає даних", ready: null };

  const sorted = [...completed].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
  const last = sorted[0];
  const nowMs = Date.now();
  const lastMs = new Date(last.startedAt).getTime();
  const hoursAgo = (nowMs - lastMs) / 3_600_000;

  if (hoursAgo < 20) return { label: "Відновлення", ready: false };
  if (hoursAgo < 44) return { label: "Часткове відновлення", ready: null };
  return { label: "Готовий до тренування", ready: true };
}

function parseFizrukWorkouts(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.workouts)) return p.workouts;
  } catch {}
  return [];
}

function useFizrukMetrics() {
  return useMemo(() => {
    const raw = localStorage.getItem("fizruk_workouts_v1");
    const workouts = parseFizrukWorkouts(raw);
    if (!workouts.length && !raw) {
      return { weekCount: 0, lastWorkout: null, recovery: { label: "Немає даних", ready: null } };
    }

    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    mon.setHours(0, 0, 0, 0);

    const completed = workouts.filter((w) => w.endedAt);
    const weekCount = completed.filter((w) => new Date(w.startedAt) >= mon).length;
    const last = [...completed].sort(
      (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
    )[0] ?? null;

    const recovery = computeRecoveryStatus(completed);

    return { weekCount, lastWorkout: last, recovery };
  }, []);
}

function useRoutineMetrics() {
  return useMemo(() => {
    const state = safeParseLS("hub_routine_v1", null);
    if (!state) return { todayDone: 0, todayTotal: 0, streak: 0 };

    const habits = Array.isArray(state.habits) ? state.habits : [];
    const active = habits.filter((h) => !h.archived);
    const completions = state.completions ?? {};
    const today = localDateKey();

    const todayDone = active.filter(
      (h) => Array.isArray(completions[h.id]) && completions[h.id].includes(today)
    ).length;

    let streak = 0;
    if (active.length > 0) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      for (let i = 0; i < 365; i++) {
        const dk = localDateKey(d);
        const allDone = active.every(
          (h) => Array.isArray(completions[h.id]) && completions[h.id].includes(dk)
        );
        if (!allDone) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
    }

    return { todayDone, todayTotal: active.length, streak };
  }, []);
}

function useNutritionMetrics() {
  return useMemo(() => {
    const log = safeParseLS("nutrition_log_v1", {});
    const today = localDateKey();
    const dayData = log?.[today];
    const meals = Array.isArray(dayData?.meals) ? dayData.meals : [];

    let kcal = 0, protein = 0, fat = 0, carbs = 0;
    for (const m of meals) {
      kcal += m?.macros?.kcal ?? 0;
      protein += m?.macros?.protein_g ?? 0;
      fat += m?.macros?.fat_g ?? 0;
      carbs += m?.macros?.carbs_g ?? 0;
    }

    const prefs = safeParseLS("nutrition_prefs_v1", null);
    const target = prefs?.dailyTargetKcal ?? 2000;

    return {
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
      target,
      mealCount: meals.length,
    };
  }, []);
}

function MetricRow({ label, value, secondary }) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <span className="text-xs text-muted truncate shrink-0">{label}</span>
      <span className="text-sm font-semibold text-text truncate">
        {value}
        {secondary && (
          <span className="text-xs text-muted font-normal ml-1">{secondary}</span>
        )}
      </span>
    </div>
  );
}

function ProgressBar({ value, max, colorClass = "bg-accent" }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div className="h-1.5 rounded-full bg-line/40 overflow-hidden mt-2">
      <div
        className={cn("h-full rounded-full transition-all", colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DashCard({ icon, label, colorClass, gradientClass, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full p-4 rounded-2xl border border-line bg-panel text-left",
        "shadow-card hover:shadow-float transition-all duration-200 active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-text/20"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none",
          gradientClass
        )}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className={cn(
              "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-[13px]",
              colorClass
            )}
          >
            {icon}
          </div>
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            {label}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-auto text-muted/60 group-hover:text-muted group-hover:translate-x-0.5 transition-all shrink-0"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
        {children}
      </div>
    </button>
  );
}

export function HubDashboard({ onOpenModule }) {
  const finyk = useFinykMetrics();
  const fizruk = useFizrukMetrics();
  const routine = useRoutineMetrics();
  const nutrition = useNutritionMetrics();

  const fmtUah = (v) =>
    v.toLocaleString("uk-UA", { maximumFractionDigits: 0 }) + " ₴";

  const recoveryIcon =
    fizruk.recovery.ready === true
      ? "💪"
      : fizruk.recovery.ready === false
      ? "😴"
      : "🔄";

  return (
    <div className="space-y-4">
      <HubRecommendations onOpenModule={onOpenModule} />

      <div className="space-y-2.5">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wider px-0.5">
        Сьогодні
      </h2>

      <div className="grid grid-cols-2 gap-2.5">
        <DashCard
          icon="💳"
          label="Фінік"
          colorClass="bg-emerald-500/10 text-emerald-600"
          gradientClass="bg-gradient-to-br from-emerald-400/10 to-teal-400/5"
          onClick={() => onOpenModule("finyk")}
        >
          {finyk.todaySpent > 0 || finyk.todayIncome > 0 ? (
            <>
              <MetricRow label="Витрати" value={fmtUah(finyk.todaySpent)} />
              {finyk.todayIncome > 0 && (
                <MetricRow label="Дохід" value={fmtUah(finyk.todayIncome)} />
              )}
              {finyk.totalBalance !== null && (
                <MetricRow label="Баланс" value={fmtUah(finyk.totalBalance)} />
              )}
            </>
          ) : finyk.totalBalance !== null ? (
            <>
              <p className="text-lg font-bold text-text leading-tight">
                {fmtUah(finyk.totalBalance)}
              </p>
              <p className="text-xs text-muted mt-0.5">Загальний баланс</p>
            </>
          ) : (
            <p className="text-xs text-muted">Немає даних</p>
          )}
        </DashCard>

        <DashCard
          icon="🏋️"
          label="Фізрук"
          colorClass="bg-sky-500/10 text-sky-600"
          gradientClass="bg-gradient-to-br from-sky-400/10 to-indigo-400/5"
          onClick={() => onOpenModule("fizruk")}
        >
          <div className="flex items-center gap-1 mb-1">
            <span className="text-base">{recoveryIcon}</span>
            <p
              className={cn(
                "text-xs font-semibold leading-tight",
                fizruk.recovery.ready === true && "text-emerald-600",
                fizruk.recovery.ready === false && "text-orange-500",
                fizruk.recovery.ready === null && "text-muted"
              )}
            >
              {fizruk.recovery.label}
            </p>
          </div>
          <p className="text-lg font-bold text-text leading-tight">
            {fizruk.weekCount}
            <span className="text-xs font-normal text-muted ml-1">трен./тиждень</span>
          </p>
          {fizruk.lastWorkout && (
            <p className="text-[11px] text-subtle mt-1 truncate">
              Останнє:{" "}
              {new Date(fizruk.lastWorkout.startedAt).toLocaleDateString("uk-UA", {
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </DashCard>

        <DashCard
          icon="✅"
          label="Рутина"
          colorClass="bg-orange-500/10 text-orange-600"
          gradientClass="bg-gradient-to-br from-orange-400/10 to-rose-400/5"
          onClick={() => onOpenModule("routine")}
        >
          {routine.todayTotal > 0 ? (
            <>
              <p className="text-2xl font-bold text-text leading-tight">
                {routine.todayDone}
                <span className="text-base font-normal text-muted">
                  /{routine.todayTotal}
                </span>
              </p>
              <p className="text-xs text-muted">звичок сьогодні</p>
              <ProgressBar
                value={routine.todayDone}
                max={routine.todayTotal}
                colorClass="bg-orange-500"
              />
              {routine.streak > 0 && (
                <p className="text-[11px] text-subtle mt-1.5">
                  🔥 {routine.streak} дн. поспіль
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">Немає активних звичок</p>
          )}
        </DashCard>

        <DashCard
          icon="🥗"
          label="Харчування"
          colorClass="bg-lime-500/10 text-lime-700"
          gradientClass="bg-gradient-to-br from-lime-400/10 to-emerald-400/5"
          onClick={() => onOpenModule("nutrition")}
        >
          {nutrition.mealCount > 0 ? (
            <>
              <p className="text-2xl font-bold text-text leading-tight">
                {nutrition.kcal}
              </p>
              <p className="text-xs text-muted">ккал сьогодні</p>
              <ProgressBar
                value={nutrition.kcal}
                max={nutrition.target}
                colorClass="bg-lime-500"
              />
              <div className="flex gap-2 mt-1.5 text-[10px] text-muted">
                <span>Б {nutrition.protein}г</span>
                <span>Ж {nutrition.fat}г</span>
                <span>В {nutrition.carbs}г</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">Немає записів</p>
          )}
        </DashCard>
      </div>
      </div>
    </div>
  );
}
