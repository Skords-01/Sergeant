import type { ChangeEvent } from "react";
import { AIDigestSection } from "./settings/AIDigestSection";
import { ExperimentalSection } from "./settings/ExperimentalSection";
import { FinykSection } from "./settings/FinykSection";
import { FizrukSection } from "./settings/FizrukSection";
import { GeneralSection } from "./settings/GeneralSection";
import { NotificationsSection } from "./settings/NotificationsSection";
import { RoutineSection } from "./settings/RoutineSection";

export interface HubSettingsPageProps {
  dark: boolean;
  onToggleDark: (event: ChangeEvent<HTMLInputElement>) => void;
  syncing: boolean;
  onSync: () => void;
  onPull: () => void;
  user: unknown;
}

export function HubSettingsPage({
  dark,
  onToggleDark,
  syncing,
  onSync,
  onPull,
  user,
}: HubSettingsPageProps) {
  return (
    <div className="flex flex-col gap-3 pt-2 pb-4">
      <GeneralSection
        dark={dark}
        onToggleDark={onToggleDark}
        syncing={syncing}
        onSync={onSync}
        onPull={onPull}
        user={user}
      />
      <AIDigestSection />
      <NotificationsSection />
      <RoutineSection />
      <FizrukSection />
      <FinykSection />
      <ExperimentalSection />
    </div>
  );
}
