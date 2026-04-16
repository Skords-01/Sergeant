import { useMemo, useState, useCallback, useEffect } from "react";
import { cn } from "@shared/lib/cn";
import { HubRecommendations } from "./HubRecommendations.jsx";
import { WeeklyDigestCard } from "./WeeklyDigestCard.jsx";
import { useWeeklyDigest, loadDigest, getWeekKey } from "./useWeeklyDigest.js";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DASHBOARD_ORDER_KEY = "hub_dashboard_order_v1";
const DEFAULT_ORDER = ["finyk", "fizruk", "routine", "nutrition"];

function safeParseLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function loadOrder() {
  const saved = safeParseLS(DASHBOARD_ORDER_KEY, null);
  if (Array.isArray(saved) && saved.length === DEFAULT_ORDER.length &&
      DEFAULT_ORDER.every(id => saved.includes(id))) {
    return saved;
  }
  return [...DEFAULT_ORDER];
}

function saveOrder(order) {
  try { localStorage.setItem(DASHBOARD_ORDER_KEY, JSON.stringify(order)); } catch {}
}

export function resetDashboardOrder() {
  try { localStorage.removeItem(DASHBOARD_ORDER_KEY); } catch {}
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
    const txRaw = safeParseLS("finyk_tx_cache", null);
    const txList = txRaw?.txs ?? txRaw ?? [];
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
    const hiddenAccounts = safeParseLS("finyk_hidden", []);
    const hiddenAccountSet = new Set(Array.isArray(hiddenAccounts) ? hiddenAccounts : []);
    const totalBalance = Array.isArray(info?.accounts)
      ? info.accounts
          .filter((a) => !hiddenAccountSet.has(a.id) && a.balance > 0 && !a.creditLimit && a.currencyCode === 980)
          .reduce((s, a) => s + (a.balance ?? 0), 0) / 100
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

function DashCard({ icon, label, colorClass, gradientClass, children, onClick, dragProps, isDragging: dragging }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full p-4 rounded-2xl border border-line bg-panel text-left",
        "shadow-card hover:shadow-float transition-all duration-200 active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-text/20",
        dragging && "opacity-60 scale-[0.97] shadow-float z-50"
      )}
      {...dragProps}
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

const MODULE_CONFIGS = {
  finyk: {
    icon: "💳",
    label: "Фінік",
    colorClass: "bg-emerald-500/10 text-emerald-600",
    gradientClass: "bg-gradient-to-br from-emerald-400/10 to-teal-400/5",
    description: "Транзакції, бюджети, борги",
  },
  fizruk: {
    icon: "🏋️",
    label: "Фізрук",
    colorClass: "bg-sky-500/10 text-sky-600",
    gradientClass: "bg-gradient-to-br from-sky-400/10 to-indigo-400/5",
    description: "Тренування та відновлення",
  },
  routine: {
    icon: "✅",
    label: "Рутина",
    colorClass: "bg-orange-500/10 text-orange-600",
    gradientClass: "bg-gradient-to-br from-orange-400/10 to-rose-400/5",
    description: "Звички та серії",
  },
  nutrition: {
    icon: "🥗",
    label: "Харчування",
    colorClass: "bg-lime-500/10 text-lime-700",
    gradientClass: "bg-gradient-to-br from-lime-400/10 to-emerald-400/5",
    description: "КБЖВ та прийоми їжі",
  },
};

function SortableCard({ id, onOpenModule }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cfg = MODULE_CONFIGS[id];
  if (!cfg) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <DashCard
        icon={cfg.icon}
        label={cfg.label}
        colorClass={cfg.colorClass}
        gradientClass={cfg.gradientClass}
        onClick={() => onOpenModule(id)}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
      >
        <p className="text-xs text-muted">{cfg.description}</p>
      </DashCard>
    </div>
  );
}

function useMondayAutoDigest() {
  const { generate } = useWeeklyDigest();

  useEffect(() => {
    const now = new Date();
    const isMonday = now.getDay() === 1;
    if (!isMonday) return;

    const weekKey = getWeekKey(now);
    const existing = loadDigest(weekKey);
    if (existing) return;

    const timer = setTimeout(() => {
      generate();
    }, 3000);
    return () => clearTimeout(timer);
  }, [generate]);
}

export function HubDashboard({ onOpenModule }) {
  const [order, setOrder] = useState(loadOrder);
  useMondayAutoDigest();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setOrder((prev) => {
        const oldIndex = prev.indexOf(active.id);
        const newIndex = prev.indexOf(over.id);
        const next = arrayMove(prev, oldIndex, newIndex);
        saveOrder(next);
        return next;
      });
    }
  }, []);

  return (
    <div className="space-y-4">
      <HubRecommendations onOpenModule={onOpenModule} />

      <WeeklyDigestCard />

      <div className="space-y-2.5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider px-0.5 flex items-center gap-1.5">
          Сьогодні
          <span className="text-[10px] text-subtle/60 font-normal normal-case tracking-normal">· утримуй щоб переставити</span>
        </h2>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-2.5">
              {order.map((id) => (
                <SortableCard key={id} id={id} onOpenModule={onOpenModule} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
