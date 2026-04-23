import {
  ModuleHeader,
  ModuleHeaderBackButton,
  ModuleHeaderChevronButton,
} from "@shared/components/layout";
import { cn } from "@shared/lib/cn";
import type { FizrukPage } from "./fizrukRoute";

interface ActiveProgramHeaderView {
  name: string;
}

export interface FizrukHeaderProps {
  page: FizrukPage;
  activeProgram?: ActiveProgramHeaderView | null;
  onBackToHub?: () => void;
  onBackToDashboard: () => void;
}

function titleFor(page: FizrukPage): string {
  switch (page) {
    case "atlas":
      return "Атлас";
    case "exercise":
      return "Вправа";
    case "plan":
      return "План";
    case "programs":
      return "Програми";
    case "body":
      return "Тіло";
    default:
      return "ФІЗРУК";
  }
}

function subtitleFor(
  page: FizrukPage,
  activeProgram?: ActiveProgramHeaderView | null,
): string {
  switch (page) {
    case "plan":
      return "Календар · нагадування · відновлення";
    case "programs":
      return activeProgram
        ? `Активна: ${activeProgram.name}`
        : "Оберіть тренувальну програму";
    case "body":
      return "Вага · сон · самопочуття";
    default:
      return "Тренування · прогрес";
  }
}

function DumbbellBadge() {
  return (
    <div
      className={cn(
        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
        "bg-gradient-to-br from-teal-100 to-cyan-100",
        "dark:from-teal-900/40 dark:to-cyan-900/30",
        "text-teal-600 dark:text-teal-400",
        "border border-teal-200/60 dark:border-teal-700/30",
        "shadow-sm",
      )}
      aria-hidden
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
      </svg>
    </div>
  );
}

export function FizrukHeader({
  page,
  activeProgram,
  onBackToHub,
  onBackToDashboard,
}: FizrukHeaderProps) {
  const isAtlas = page === "atlas";
  const isExercise = page === "exercise";
  const showChevronBack = isAtlas || isExercise;

  // Module-level settings drawer was dropped per user request — all
  // Fizruk settings (backup, reminders, data reset) now live in the
  // Hub-wide Settings screen. The header no longer owns a gear icon,
  // so the right slot is left empty.
  let left = null;
  if (showChevronBack) {
    left = <ModuleHeaderChevronButton onClick={onBackToDashboard} />;
  } else if (typeof onBackToHub === "function") {
    left = <ModuleHeaderBackButton onClick={onBackToHub} />;
  } else {
    left = <DumbbellBadge />;
  }

  return (
    <ModuleHeader
      left={left}
      title={titleFor(page)}
      subtitle={showChevronBack ? undefined : subtitleFor(page, activeProgram)}
    />
  );
}
