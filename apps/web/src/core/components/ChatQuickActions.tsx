// Quick action chips для HubChat (spec §2).
//
// - top-level показує до 6 chip-ів + кнопку "Ще";
// - "Ще" відкриває розширений inline-список (без modal — щоб не ламати
//   focus trap і keyboard inset на mobile);
// - повний prompt → одразу `onSend(prompt)`;
// - неповний prompt (`isIncompletePrompt`) → `onPrefill(prompt)` + focus
//   на input (фокус робить викликаючий компонент через ref);
// - в `loading` або `offline` AI-залежні chip-и disabled.

import { useState } from "react";
import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";
import {
  QUICK_ACTIONS,
  isIncompletePrompt,
  pickTopQuickActions,
  sortQuickActionsForModule,
  type QuickAction,
  type QuickActionModule,
} from "../lib/hubChatQuickActions";

interface ChatQuickActionsProps {
  /** Активний модуль (з URL hash). `null` — генеричний топ. */
  activeModule: QuickActionModule | null;
  /** Чи в стрімі / завантаженні відповіді. Disable-ить усі chip-и. */
  loading: boolean;
  /** Стан мережі. Якщо false — disable-ить `requiresOnline`. */
  online: boolean;
  /** Викликається для повних prompt-ів — одразу шле повідомлення. */
  onSend: (prompt: string) => void;
  /**
   * Викликається для неповних prompt-ів (закінчуються на `: `):
   * вставляє текст в input і фокусує поле.
   */
  onPrefill: (prompt: string) => void;
}

const MAX_VISIBLE = 6;

function chipClassName({
  disabled,
  module,
  active,
}: {
  disabled: boolean;
  module: QuickActionModule;
  active: boolean;
}): string {
  return cn(
    "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
    active
      ? "bg-brand-500/10 border border-brand-500/40 text-brand-600 hover:bg-brand-500/15"
      : module === "hub"
        ? "bg-panel border border-line text-text hover:border-muted"
        : "bg-panel border border-line text-subtle hover:text-text hover:border-muted",
    disabled && "opacity-40 cursor-not-allowed",
  );
}

export function ChatQuickActions({
  activeModule,
  loading,
  online,
  onSend,
  onPrefill,
}: ChatQuickActionsProps) {
  const [expanded, setExpanded] = useState(false);

  const topActions = pickTopQuickActions(
    QUICK_ACTIONS,
    activeModule,
    MAX_VISIBLE,
  );
  const allSorted = sortQuickActionsForModule(QUICK_ACTIONS, activeModule);
  const moreActions = allSorted.slice(MAX_VISIBLE);

  const handleClick = (a: QuickAction) => {
    if (isIncompletePrompt(a.prompt)) {
      onPrefill(a.prompt);
    } else {
      onSend(a.prompt);
    }
  };

  const renderChip = (a: QuickAction) => {
    const disabled = loading || (a.requiresOnline && !online);
    const reason =
      !online && a.requiresOnline ? "Потрібне з'єднання" : undefined;
    return (
      <button
        key={a.id}
        type="button"
        data-testid={`chat-quick-action-${a.id}`}
        onClick={() => handleClick(a)}
        disabled={disabled}
        title={reason || a.description || a.label}
        aria-label={a.label}
        className={chipClassName({
          disabled,
          module: a.module,
          active: activeModule === a.module && a.module !== "hub",
        })}
      >
        <Icon name={a.icon} size={13} aria-hidden />
        <span className="hidden sm:inline">{a.label}</span>
        <span className="sm:hidden">{a.shortLabel}</span>
      </button>
    );
  };

  return (
    <div
      className="px-4 pt-2 pb-1 shrink-0"
      role="group"
      aria-label="Швидкі сценарії"
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {topActions.map(renderChip)}
        {moreActions.length > 0 && (
          <button
            type="button"
            data-testid="chat-quick-actions-more"
            onClick={() => setExpanded((v) => !v)}
            disabled={loading}
            aria-expanded={expanded}
            aria-controls="chat-quick-actions-more-list"
            className={chipClassName({
              disabled: loading,
              module: "hub",
              active: false,
            })}
          >
            <Icon
              name={expanded ? "chevron-up" : "chevron-down"}
              size={13}
              aria-hidden
            />
            {expanded ? "Згорнути" : "Ще"}
          </button>
        )}
      </div>

      {expanded && moreActions.length > 0 && (
        <div
          id="chat-quick-actions-more-list"
          className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {moreActions.map(renderChip)}
        </div>
      )}
    </div>
  );
}
