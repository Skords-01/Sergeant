import {
  ModuleHeader,
  ModuleHeaderAssistantButton,
  ModuleHeaderBackButton,
} from "@shared/components/layout";
import { cn } from "@shared/lib/ui/cn";
import type { SyncTone } from "./FinykApp.helpers";

interface FinykAppHeaderProps {
  onBackToHub?: () => void;
  syncTone: SyncTone;
  showBalance: boolean;
  onToggleShowBalance: () => void;
}

// Header chrome for FinykApp. Pulled out so the composition root keeps
// state wiring distinct from presentational chrome (icons + sync pill +
// balance-visibility toggle). The balance icons are inlined `svg`s on
// purpose — they were that way before decomposition and we keep
// behaviour identity (no new dependency on `Icon`).
export function FinykAppHeader({
  onBackToHub,
  syncTone,
  showBalance,
  onToggleShowBalance,
}: FinykAppHeaderProps) {
  return (
    <ModuleHeader
      module="finyk"
      left={
        typeof onBackToHub === "function" ? (
          <ModuleHeaderBackButton onClick={onBackToHub} />
        ) : (
          <div
            className="shrink-0 w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success-strong dark:text-success border border-success/15"
            aria-hidden
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
        )
      }
      title="ФІНІК"
      subtitle="Monobank · бюджети"
      right={
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 select-none",
              "text-style-caption px-2 py-0.5 rounded-full border",
              "transition-colors duration-200",
              syncTone.pill,
            )}
            aria-label={`Стан синхронізації: ${syncTone.text}`}
          >
            <span
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", syncTone.dot)}
            />
            <span className="hidden sm:inline">{syncTone.text}</span>
          </div>
          <button
            type="button"
            onClick={onToggleShowBalance}
            className="focus-ring w-11 h-11 flex items-center justify-center rounded-xl text-subtle hover:text-text hover:bg-panelHi transition-colors"
            aria-label={showBalance ? "Приховати суми" : "Показати суми"}
            title={showBalance ? "Приховати суми" : "Показати суми"}
          >
            {showBalance ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
          <ModuleHeaderAssistantButton />
        </div>
      }
    />
  );
}
