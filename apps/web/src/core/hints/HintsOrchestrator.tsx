import { useEffect, useMemo, useRef } from "react";
import {
  pickNextHint,
  recordHintShown,
  type HintContext,
  type HintId,
  type KVStore,
} from "@sergeant/shared";
import { useToast } from "@shared/hooks/useToast";
import { ANALYTICS_EVENTS, trackEvent } from "../analytics";
import { useHubPref } from "../settings/hubPrefs";

const localStorageStore: KVStore = {
  getString(key) {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  setString(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* noop */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

export interface HintsOrchestratorProps {
  inFtuxSession: boolean;
  hasFirstRealEntry: boolean;
}

export function HintsOrchestrator({
  inFtuxSession,
  hasFirstRealEntry,
}: HintsOrchestratorProps) {
  const toast = useToast();
  const [showHints] = useHubPref<boolean>("showHints", true);
  const shownThisMount = useRef<HintId | null>(null);

  const ctx = useMemo<HintContext>(
    () => ({
      platform: "web",
      surface: "hub",
      inFtuxSession,
      hasFirstRealEntry,
    }),
    [hasFirstRealEntry, inFtuxSession],
  );

  const candidates = useMemo<readonly HintId[]>(() => {
    if (inFtuxSession) {
      return [
        "ftux_quick_add",
        "ftux_switch_modules",
        "ftux_open_search",
        "ftux_open_chat",
        "ftux_reports_unlock",
      ];
    }
    if (hasFirstRealEntry) {
      return ["module_first_entry", "hub_reorder_modules"];
    }
    return [];
  }, [hasFirstRealEntry, inFtuxSession]);

  useEffect(() => {
    if (!showHints) return;
    if (shownThisMount.current) return;
    if (candidates.length === 0) return;

    const next = pickNextHint(localStorageStore, candidates, ctx);
    if (!next) return;

    shownThisMount.current = next;
    recordHintShown(localStorageStore, next);
    trackEvent(ANALYTICS_EVENTS.HINT_SHOWN, {
      id: next,
      surface: ctx.surface,
      platform: ctx.platform,
      inFtuxSession: Boolean(ctx.inFtuxSession),
      hasFirstRealEntry: Boolean(ctx.hasFirstRealEntry),
    });

    const msg = (() => {
      switch (next) {
        case "ftux_open_search":
          return "Порада: відкрий пошук (Ctrl/⌘K) — швидко знаходить модулі та дії.";
        case "ftux_open_chat":
          return "Порада: в чаті спитай «Що мені важливо сьогодні?»";
        case "ftux_switch_modules":
          return "Перемикай модулі зверху — це один хаб.";
        case "ftux_reports_unlock":
          return "Звіти з’являться після першого запису.";
        case "ftux_quick_add":
          return "Швидке додавання — найкоротший шлях до результату.";
        case "module_first_entry":
          return "Після першого запису спробуй «Звіти» — там найшвидше видно прогрес.";
        case "hub_reorder_modules":
          return "Можна переставити модулі: Налаштування → Загальні → Упорядкувати модулі.";
        default:
          return null;
      }
    })();

    if (!msg) return;

    const action =
      next === "ftux_open_chat"
        ? {
            label: "Відкрити чат",
            onClick: () => {
              try {
                window.dispatchEvent(
                  new CustomEvent("hub:openChat", {
                    detail: "Що мені важливо сьогодні?",
                  }),
                );
                trackEvent(ANALYTICS_EVENTS.HINT_CLICKED, { id: next });
              } catch {
                /* noop */
              }
            },
          }
        : next === "ftux_open_search"
          ? {
              label: "Пошук",
              onClick: () => {
                try {
                  window.dispatchEvent(new CustomEvent("hub:openSearch"));
                  trackEvent(ANALYTICS_EVENTS.HINT_CLICKED, { id: next });
                } catch {
                  /* noop */
                }
              },
            }
          : undefined;

    toast.info(msg, 5000, action);
  }, [candidates, ctx, showHints, toast]);

  return null;
}
