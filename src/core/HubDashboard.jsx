import { useState, useCallback, useEffect } from "react";
import { safeReadLS, safeWriteLS, safeRemoveLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { HubRecommendations } from "./HubRecommendations.jsx";
import { WeeklyDigestCard } from "./WeeklyDigestCard.jsx";
import { CoachInsightCard } from "./CoachInsightCard.jsx";
import { DailyFinykSummaryCard } from "./DailyFinykSummaryCard.jsx";
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
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { DailyProgressHero } from "./dashboard/DailyProgressHero.jsx";
import { SortableCard } from "./dashboard/ModuleCard.jsx";
import { MODULE_ORDER_DEFAULT } from "./dashboard/moduleConfigs.jsx";

const DASHBOARD_ORDER_KEY = STORAGE_KEYS.DASHBOARD_ORDER;
const HUB_PREFS_KEY = STORAGE_KEYS.HUB_PREFS;

function loadOrder() {
  const saved = safeReadLS(DASHBOARD_ORDER_KEY, null);
  if (
    Array.isArray(saved) &&
    saved.length === MODULE_ORDER_DEFAULT.length &&
    MODULE_ORDER_DEFAULT.every((id) => saved.includes(id))
  ) {
    return saved;
  }
  return [...MODULE_ORDER_DEFAULT];
}

function saveOrder(order) {
  safeWriteLS(DASHBOARD_ORDER_KEY, order);
}

export function resetDashboardOrder() {
  safeRemoveLS(DASHBOARD_ORDER_KEY);
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

export function HubDashboard({ onOpenModule, onOpenChat }) {
  const [order, setOrder] = useState(loadOrder);
  useMondayAutoDigest();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
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

  const [showCoach, setShowCoach] = useState(
    () => safeReadLS(HUB_PREFS_KEY, {}).showCoach !== false,
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === HUB_PREFS_KEY || e.key === null) {
        setShowCoach(safeReadLS(HUB_PREFS_KEY, {}).showCoach !== false);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className="space-y-5">
      <DailyProgressHero />
      <DailyFinykSummaryCard />
      <HubRecommendations onOpenModule={onOpenModule} />
      {showCoach && <CoachInsightCard onOpenChat={onOpenChat} />}
      <WeeklyDigestCard />

      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Модулі
          </h2>
          <span className="text-[10px] text-subtle">
            Утримуй, щоб переставити
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 stagger-enter">
              {order.map((id) => (
                <SortableCard key={id} id={id} onOpenModule={onOpenModule} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}
