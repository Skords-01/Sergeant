import { useCallback, useState } from "react";
import { shouldShowOnboarding } from "../OnboardingWizard.jsx";

export type HubView = "dashboard" | "reports" | "recommendations";

export interface HubUIState {
  chatOpen: boolean;
  chatInitialMessage: string | null;
  searchOpen: boolean;
  hubView: HubView;
  onboarding: boolean;
  setHubView: (view: HubView) => void;
  setOnboarding: (value: boolean) => void;
  setSearchOpen: (value: boolean) => void;
  openChat: (message?: string | null) => void;
  closeChat: () => void;
  closeSearch: () => void;
}

export function useHubUIState(): HubUIState {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [hubView, setHubView] = useState<HubView>("dashboard");
  const [onboarding, setOnboarding] = useState<boolean>(() =>
    shouldShowOnboarding(),
  );

  const openChat = useCallback((message: string | null = null) => {
    setChatInitialMessage(message || null);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setChatInitialMessage(null);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return {
    chatOpen,
    chatInitialMessage,
    searchOpen,
    hubView,
    onboarding,
    setHubView,
    setOnboarding,
    setSearchOpen,
    openChat,
    closeChat,
    closeSearch,
  };
}
