import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import {
  countRealEntries,
  getActiveNudge,
  getVibePicks,
  recordLastActiveDate,
  shouldShowReengagement,
  type User,
} from "@sergeant/shared";
import { openHubModule, openHubModuleWithAction } from "@shared/lib/hubNav";
import { getModulePrimaryAction } from "@shared/lib/moduleQuickActions";
import { TodayFocusCard, useDashboardFocus } from "../insights/TodayFocusCard";
import { HubInsightsPanel } from "./HubInsightsPanel";
import {
  WeeklyDigestCard,
  hasLiveWeeklyDigest,
} from "../insights/WeeklyDigestCard";
import { useCoachInsight } from "../insights/useCoachInsight";
import { AssistantAdviceCard } from "../insights/AssistantAdviceCard";
import { SoftAuthPromptCard } from "../onboarding/SoftAuthPromptCard";
import { FirstActionHeroCard } from "../onboarding/FirstActionSheet";
import { detectFirstRealEntry } from "../onboarding/firstRealEntry";
import {
  getSessionDays,
  isFirstActionPending,
  isSoftAuthDismissed,
  recordSessionDay,
} from "../onboarding/vibePicks";
import { useFirstEntryCelebration } from "../onboarding/useFirstEntryCelebration";
import { DailyNudge } from "../onboarding/DailyNudge";
import { ReEngagementCard } from "../onboarding/ReEngagementCard";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { DASHBOARD_MODULE_LABELS as SHARED_DASHBOARD_MODULE_LABELS } from "@sergeant/shared";
import {
  loadDashboardOrder,
  localStorageStore,
  saveDashboardOrder,
} from "./dashboard/dashboardStore";
import { type ModuleId } from "./dashboard/moduleConfigs";
import { SortableCard } from "./dashboard/BentoCard";
import {
  MotivationalFooter,
  StaggerChild,
  StreakIndicator,
  TodaySummaryStrip,
  WeeklyDigestFooter,
} from "./dashboard/dashboardCards";
import { useMondayAutoDigest } from "./dashboard/useMondayAutoDigest";

export const DASHBOARD_MODULE_LABELS = SHARED_DASHBOARD_MODULE_LABELS;
export {
  loadDashboardOrder,
  saveDashboardOrder,
  resetDashboardOrder,
} from "./dashboard/dashboardStore";

interface HubDashboardProps {
  onOpenModule: (module: string) => void;
  onOpenChat?: () => void;
  user: User | null;
  onShowAuth: () => void;
}

export function HubDashboard({
  onOpenModule,
  onOpenChat: _onOpenChat,
  user,
  onShowAuth,
}: HubDashboardProps) {
  const [order, setOrder] = useState(loadDashboardOrder);
  useMondayAutoDigest();

  const [firstActionVisible, setFirstActionVisible] = useState(() =>
    isFirstActionPending(),
  );

  const hasRealEntry = detectFirstRealEntry();
  useFirstEntryCelebration(hasRealEntry);
  const [sessionDays, setSessionDays] = useState(-1);
  useEffect(() => {
    setSessionDays(recordSessionDay() || getSessionDays());
  }, []);
  const SOFT_AUTH_SESSION_DAYS_THRESHOLD = 3;
  const [softAuthDismissed, setSoftAuthDismissed] = useState(() =>
    isSoftAuthDismissed(),
  );
  const entryCount = useMemo(() => countRealEntries(localStorageStore), []);
  const showSoftAuth =
    !user &&
    !softAuthDismissed &&
    typeof onShowAuth === "function" &&
    (hasRealEntry || sessionDays >= SOFT_AUTH_SESSION_DAYS_THRESHOLD);

  const [reengagement, setReengagement] = useState(() =>
    shouldShowReengagement(localStorageStore),
  );
  useEffect(() => {
    recordLastActiveDate(localStorageStore);
  }, []);

  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const activeNudge = useMemo(() => {
    if (nudgeDismissed || sessionDays < 2) return null;
    return getActiveNudge(localStorageStore, sessionDays, {
      picks: getVibePicks(localStorageStore),
    });
  }, [sessionDays, nudgeDismissed]);

  const { focus, rest, dismiss } = useDashboardFocus();

  // Insights з deep-link (`actionHash`) повинні відкрити модуль рівно
  // на потрібній вкладці/елементі — не на дефолтному Огляді. Якщо
  // hash немає, лишаємо стару поведінку (просто перейти на модуль).
  const openInsightTarget = useCallback(
    (module: string, hash?: string) => {
      if (hash) {
        openHubModule(module as Parameters<typeof openHubModule>[0], hash);
        return;
      }
      onOpenModule(module);
    },
    [onOpenModule],
  );

  const {
    insight: coachInsightText,
    loading: coachLoading,
    error: coachError,
    refresh: coachRefresh,
  } = useCoachInsight();

  const modulesWithSignal = useMemo(() => {
    const all = focus ? [focus, ...rest] : rest;
    const set = new Set<string>();
    for (const r of all) {
      if (r.module && r.module !== "hub") set.add(r.module);
    }
    return set;
  }, [focus, rest]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const quickAddByModule = useMemo(() => {
    const map: Record<string, { label: string; run: () => void } | undefined> =
      {};
    for (const id of modulesWithSignal) {
      const quick = getModulePrimaryAction(id);
      if (!quick) continue;
      map[id] = {
        label: quick.label,
        run: () =>
          openHubModuleWithAction(
            id as Parameters<typeof openHubModuleWithAction>[0],
            quick.action,
          ),
      };
    }
    return map;
  }, [modulesWithSignal]);

  const handleDragEnd = useCallback(
    (event: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        setOrder((prev) => {
          const activeId = String(active.id) as ModuleId;
          const overId = String(over.id) as ModuleId;
          const oldIndex = prev.indexOf(activeId);
          const newIndex = prev.indexOf(overId);
          const next = arrayMove(prev, oldIndex, newIndex);
          saveDashboardOrder(next);
          return next;
        });
      }
    },
    [],
  );

  const [digestExpanded, setDigestExpanded] = useState(false);
  const digestFresh = hasLiveWeeklyDigest();
  const now = new Date();
  const isMondayOrTuesday = now.getDay() === 1 || now.getDay() === 2;
  const showDigestFooter = digestFresh || isMondayOrTuesday;

  // ONE-HERO RULE
  let hero: React.ReactNode;
  if (firstActionVisible) {
    hero = (
      <FirstActionHeroCard onDismiss={() => setFirstActionVisible(false)} />
    );
  } else if (showSoftAuth) {
    hero = (
      <SoftAuthPromptCard
        onOpenAuth={onShowAuth}
        onDismiss={() => setSoftAuthDismissed(true)}
        entryCount={entryCount}
      />
    );
  } else {
    hero = (
      <TodayFocusCard
        focus={focus}
        onAction={onOpenModule}
        onDismiss={dismiss}
      />
    );
  }

  // Stagger index counter
  let si = 0;

  return (
    <div className="space-y-4">
      {reengagement.show && (
        <StaggerChild index={si++}>
          <ReEngagementCard
            daysInactive={reengagement.daysInactive}
            onContinue={() => setReengagement({ show: false, daysInactive: 0 })}
            onDismiss={() => setReengagement({ show: false, daysInactive: 0 })}
          />
        </StaggerChild>
      )}

      {/* Streak indicator */}
      <StaggerChild index={si++}>
        <StreakIndicator />
      </StaggerChild>

      {/* Hero card */}
      <StaggerChild index={si++}>{hero}</StaggerChild>

      {/* "Твій день" summary strip */}
      <StaggerChild index={si++}>
        <TodaySummaryStrip onOpenModule={onOpenModule} />
      </StaggerChild>

      {/* Assistant advice — hide error state */}
      <StaggerChild index={si++}>
        <AssistantAdviceCard
          insight={coachInsightText}
          loading={coachLoading}
          error={coachError}
          onRefresh={coachRefresh}
        />
      </StaggerChild>

      {activeNudge && !reengagement.show && (
        <StaggerChild index={si++}>
          <DailyNudge
            nudge={activeNudge}
            sessionDays={sessionDays}
            onDismiss={() => setNudgeDismissed(true)}
          />
        </StaggerChild>
      )}

      {/* MODULE CARDS — 2×2 bento grid */}
      <StaggerChild index={si++}>
        <section className="space-y-2">
          <SectionHeading as="h2" size="xs" className="px-0.5">
            Модулі
          </SectionHeading>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3">
                {order.map((id) => (
                  <SortableCard
                    key={id}
                    id={id as ModuleId}
                    onOpenModule={onOpenModule}
                    quickAdd={quickAddByModule[id] || null}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </StaggerChild>

      {/* Secondary content */}
      <StaggerChild index={si++}>
        <div className="space-y-2">
          <HubInsightsPanel
            items={rest}
            onOpenModule={openInsightTarget}
            onDismiss={dismiss}
          />

          {digestExpanded ? (
            <WeeklyDigestCard onCollapse={() => setDigestExpanded(false)} />
          ) : showDigestFooter ? (
            <WeeklyDigestFooter
              fresh={digestFresh}
              onExpand={() => setDigestExpanded(true)}
            />
          ) : null}
        </div>
      </StaggerChild>

      {/* Motivational footer */}
      <MotivationalFooter />
    </div>
  );
}
