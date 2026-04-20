import { useCallback, useState } from "react";

export type HubView = "dashboard" | "reports" | "settings";

// Onboarding is now a URL-addressable route (`/welcome`) owned by
// `AppInner`; it no longer lives in hub UI state. The router handles
// gating and redirects, so this hook only tracks chat/search/hub-view.
export interface HubUIState {
  chatOpen: boolean;
  chatInitialMessage: string | null;
  searchOpen: boolean;
  hubView: HubView;
  setHubView: (view: HubView) => void;
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
    setHubView,
    setSearchOpen,
    openChat,
    closeChat,
    closeSearch,
  };
}
