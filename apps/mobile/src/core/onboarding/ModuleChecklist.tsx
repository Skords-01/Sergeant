import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  MODULE_CHECKLISTS,
  getChecklistState,
  markChecklistStepDone,
  markChecklistSeen,
  dismissChecklist,
  isChecklistVisible,
  type DashboardModuleId,
  type KVStore,
  hapticTap,
} from "@sergeant/shared";

import {
  safeReadLS as mmkvGet,
  safeRemoveLS as mmkvRemove,
  safeWriteLS as mmkvWrite,
} from "@/lib/storage";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const mmkvStore: KVStore = {
  getString(key) {
    try {
      return mmkvGet(key) ?? null;
    } catch {
      return null;
    }
  },
  setString(key, value) {
    try {
      mmkvWrite(key, value);
    } catch {
      /* noop */
    }
  },
  remove(key) {
    try {
      mmkvRemove(key);
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
    isChecklistVisible(mmkvStore, moduleId),
  );
  const [state, setState] = useState(() =>
    getChecklistState(mmkvStore, moduleId),
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
    markChecklistSeen(mmkvStore, moduleId);
  }, [visible, moduleId]);

  const handleStepDone = useCallback(
    (stepId: string) => {
      hapticTap();
      const next = markChecklistStepDone(mmkvStore, moduleId, stepId);
      setState(next);
      if (next.completedSteps.length >= def.steps.length) {
        setVisible(false);
      }
    },
    [moduleId, def.steps.length],
  );

  const handleDismiss = useCallback(() => {
    dismissChecklist(mmkvStore, moduleId);
    setVisible(false);
  }, [moduleId]);

  if (!visible) return null;

  return (
    <View className="rounded-2xl border border-cream-200 bg-cream-50 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-stone-900">
          {def.title}{" "}
          <Text className="text-xs font-normal text-stone-400">
            ({completed}/{total})
          </Text>
        </Text>
        <Pressable
          onPress={handleDismiss}
          hitSlop={12}
          accessibilityLabel="Сховати чекліст"
        >
          <Text className="text-xs text-stone-400">✕</Text>
        </Pressable>
      </View>

      <View className="gap-1.5">
        {def.steps.map((step) => {
          const done = state.completedSteps.includes(step.id);
          return (
            <Pressable
              key={step.id}
              onPress={() => {
                if (!done) {
                  handleStepDone(step.id);
                  if (step.action) onAction?.(step.action);
                }
              }}
              disabled={done}
              className={cx(
                "flex-row items-center gap-2.5 rounded-xl px-3 py-2",
                !done && "active:opacity-70",
              )}
            >
              <View
                className={cx(
                  "h-5 w-5 items-center justify-center rounded-full border",
                  done
                    ? "border-brand-500 bg-brand-500"
                    : "border-cream-300 bg-white",
                )}
              >
                {done && (
                  <Text className="text-[10px] font-bold text-white">✓</Text>
                )}
              </View>
              <Text
                className={cx(
                  "flex-1 text-sm",
                  done ? "text-stone-400 line-through" : "text-stone-900",
                )}
              >
                {step.label}
              </Text>
              {!done && step.action && (
                <Text className="text-xs text-stone-400">›</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
