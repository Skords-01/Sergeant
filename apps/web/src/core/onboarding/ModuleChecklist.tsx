import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { Button } from "@shared/components/ui/Button";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import {
  MODULE_CHECKLISTS,
  getChecklistState,
  markChecklistStepDone,
  markChecklistSeen,
  dismissChecklist,
  isChecklistVisible,
  type DashboardModuleId,
  type KVStore,
} from "@sergeant/shared";

const localStorageStore: KVStore = {
  getString: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setString: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* noop */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  },
};

export function ModuleChecklist({
  moduleId,
  onAction,
}: {
  moduleId: DashboardModuleId;
  onAction?: (action: string) => void;
}) {
  const [visible, setVisible] = useState(() =>
    isChecklistVisible(localStorageStore, moduleId),
  );
  const [state, setState] = useState(() =>
    getChecklistState(localStorageStore, moduleId),
  );

  const def = MODULE_CHECKLISTS[moduleId];
  const completed = useMemo(
    () =>
      state.completedSteps.filter((s) =>
        def.steps.some((step) => step.id === s),
      ).length,
    [state.completedSteps, def.steps],
  );
  const total = def.steps.length;

  useEffect(() => {
    if (!visible) return;
    markChecklistSeen(localStorageStore, moduleId);
    trackEvent(ANALYTICS_EVENTS.MODULE_CHECKLIST_SHOWN, {
      module: moduleId,
      completed,
      total,
    });
  }, [visible, moduleId, completed, total]);

  const handleStepDone = useCallback(
    (stepId: string) => {
      const next = markChecklistStepDone(localStorageStore, moduleId, stepId);
      setState(next);
      trackEvent(ANALYTICS_EVENTS.MODULE_CHECKLIST_STEP_DONE, {
        module: moduleId,
        step: stepId,
      });
      if (next.completedSteps.length >= def.steps.length) {
        setVisible(false);
      }
    },
    [moduleId, def.steps.length],
  );

  const handleDismiss = useCallback(() => {
    dismissChecklist(localStorageStore, moduleId);
    setVisible(false);
    trackEvent(ANALYTICS_EVENTS.MODULE_CHECKLIST_DISMISSED, {
      module: moduleId,
      completedSteps: state.completedSteps.length,
    });
  }, [moduleId, state.completedSteps.length]);

  if (!visible) return null;

  return (
    <section
      className="bg-panel border border-line rounded-2xl p-4 shadow-card space-y-3"
      aria-label={def.title}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text">
            {def.title}{" "}
            <span className="text-xs font-normal text-muted">
              ({completed}/{total})
            </span>
          </h3>
        </div>
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          onClick={handleDismiss}
          aria-label="Сховати чекліст"
          className="shrink-0 -mt-1 -mr-1 text-muted hover:text-text"
        >
          <Icon name="close" size={14} />
        </Button>
      </div>

      <div className="space-y-1.5">
        {def.steps.map((step) => {
          const done = state.completedSteps.includes(step.id);
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (!done) {
                  handleStepDone(step.id);
                  if (step.action) onAction?.(step.action);
                }
              }}
              disabled={done}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
                done
                  ? "text-muted line-through opacity-60"
                  : "text-text hover:bg-brand-500/5 hover:border-brand-500/20 border border-transparent",
              )}
            >
              <span
                className={cn(
                  "shrink-0 w-5 h-5 rounded-full flex items-center justify-center border",
                  done
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "border-line bg-panel",
                )}
              >
                {done && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
              <span className="flex-1">{step.label}</span>
              {!done && step.action && (
                <Icon name="chevron-right" size={14} className="text-muted" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
