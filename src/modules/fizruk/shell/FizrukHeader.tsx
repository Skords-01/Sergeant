import {
  ModuleHeader,
  ModuleHeaderBackButton,
  ModuleHeaderChevronButton,
  ModuleHeaderIconButton,
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
  onOpenSettings: () => void;
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

function SettingsIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function FizrukHeader({
  page,
  activeProgram,
  onBackToHub,
  onBackToDashboard,
  onOpenSettings,
}: FizrukHeaderProps) {
  const isAtlas = page === "atlas";
  const isExercise = page === "exercise";
  const showChevronBack = isAtlas || isExercise;

  let left = null;
  if (showChevronBack) {
    left = <ModuleHeaderChevronButton onClick={onBackToDashboard} />;
  } else if (typeof onBackToHub === "function") {
    left = <ModuleHeaderBackButton onClick={onBackToHub} />;
  } else {
    left = <DumbbellBadge />;
  }

  const right = (
    <ModuleHeaderIconButton
      onClick={onOpenSettings}
      ariaLabel="Налаштування даних"
    >
      <SettingsIcon />
    </ModuleHeaderIconButton>
  );

  return (
    <ModuleHeader
      left={left}
      right={right}
      title={titleFor(page)}
      eyebrow={showChevronBack ? undefined : "ОСОБИСТИЙ ЖУРНАЛ"}
      subtitle={showChevronBack ? undefined : subtitleFor(page, activeProgram)}
    />
  );
}
