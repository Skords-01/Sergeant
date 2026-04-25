import { useNavigate } from "react-router-dom";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { useAuth } from "../AuthContext";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { DangerZoneSection } from "./DangerZoneSection";
import { MemoryBankSection } from "./MemoryBankSection";
import { PersonalInfoSection } from "./PersonalInfoSection";
import { SessionsSection } from "./SessionsSection";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, refresh } = useAuth();
  const online = useOnlineStatus();

  if (!user) {
    return null;
  }

  return (
    <div
      className="min-h-dvh bg-bg"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="max-w-lg mx-auto px-5 pb-8 space-y-4">
        <div className="flex items-center gap-3 pt-6 pb-2">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => navigate(-1)}
            aria-label="Назад"
          >
            <Icon name="chevron-left" size={20} />
          </Button>
          <h1 className="text-xl font-bold text-text">Профіль</h1>
        </div>

        {!online && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/30 px-4 py-3">
            <Icon name="wifi-off" size={16} className="text-warning shrink-0" />
            <p className="text-sm text-warning font-medium">
              Ви офлайн — редагування профілю тимчасово недоступне
            </p>
          </div>
        )}

        <PersonalInfoSection user={user} online={online} onRefresh={refresh} />
        <MemoryBankSection />
        <ChangePasswordSection online={online} />
        <SessionsSection online={online} />
        <DangerZoneSection online={online} onLogout={logout} />
      </div>
    </div>
  );
}
