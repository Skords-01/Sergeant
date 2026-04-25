import { useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { SectionHeading } from "@shared/components/ui/SectionHeading";

interface AssistantAdviceCardProps {
  insight: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const COLLAPSED_KEY = "hub_assistant_advice_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean): void {
  try {
    if (v) localStorage.setItem(COLLAPSED_KEY, "1");
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch {
    /* noop */
  }
}

export function AssistantAdviceCard({
  insight,
  loading,
  error,
  onRefresh,
}: AssistantAdviceCardProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };

  // Hide the card entirely when there's an error and no cached insight
  if (error && !insight && !loading) return null;

  const hasContent = !!(insight || loading);
  if (!hasContent) return null;

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden",
        "transition-all duration-200",
        "p-[1px] bg-gradient-to-br from-brand-300/40 via-line to-teal-300/40",
      )}
    >
      <div className="rounded-[15px] bg-panel overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center justify-between w-full px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center text-xs"
              aria-hidden
            >
              S
            </span>
            <SectionHeading as="span" size="xs" tone="muted">
              Порада асистента
            </SectionHeading>
          </div>
          <Icon
            name={collapsed ? "chevron-down" : "chevron-up"}
            size={14}
            className="text-muted"
          />
        </button>

        {!collapsed && (
          <div className="px-4 pb-3.5 -mt-0.5">
            {loading && !insight && (
              <p className="text-sm text-muted animate-pulse">Готую пораду…</p>
            )}

            {insight && (
              <p className="text-sm text-text leading-relaxed">{insight}</p>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={loading}
              aria-label="Оновити пораду"
              className={cn(
                "mt-2 p-1 rounded-lg text-muted hover:text-text hover:bg-panelHi transition-colors",
                loading && "opacity-40 cursor-not-allowed animate-spin",
              )}
            >
              <Icon name="refresh-cw" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
