import { AIDigestSection } from "./settings/AIDigestSection.jsx";
import { ExperimentalSection } from "./settings/ExperimentalSection.jsx";
import { FinykSection } from "./settings/FinykSection.jsx";
import { FizrukSection } from "./settings/FizrukSection.jsx";
import { GeneralSection } from "./settings/GeneralSection.jsx";
import { NotificationsSection } from "./settings/NotificationsSection.jsx";
import { RoutineSection } from "./settings/RoutineSection.jsx";

export function HubSettingsPage({
  dark,
  onToggleDark,
  syncing,
  onSync,
  onPull,
  user,
}) {
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
