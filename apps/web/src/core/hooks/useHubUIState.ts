import { useCallback, useEffect, useState } from "react";

export type HubView = "dashboard" | "reports" | "settings";

const VALID_VIEWS = new Set<string>(["dashboard", "reports", "settings"]);

function readViewFromURL(): HubView {
  try {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param && VALID_VIEWS.has(param)) return param as HubView;
  } catch {
    /* SSR / non-browser */
  }
  return "dashboard";
}

/** Options for `openChat`. */
export interface OpenChatOptions {
  /**
   * If true, the assistant immediately sends `message` instead of
   * prefilling it into the input. Used by the catalogue page when the
   * user taps a `requiresInput=false` capability.
   */
  autoSend?: boolean;
}

// Onboarding is now a URL-addressable route (`/welcome`) owned by
// `AppInner`; it no longer lives in hub UI state. The router handles
// gating and redirects, so this hook only tracks chat/search/hub-view.
export interface HubUIState {
  chatOpen: boolean;
  chatInitialMessage: string | null;
  chatAutoSend: boolean;
  searchOpen: boolean;
  hubView: HubView;
  setHubView: (view: HubView) => void;
  setSearchOpen: (value: boolean) => void;
  openChat: (message?: string | null, options?: OpenChatOptions) => void;
  closeChat: () => void;
  closeSearch: () => void;
}

export function useHubUIState(): HubUIState {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | null>(
    null,
  );
  const [chatAutoSend, setChatAutoSend] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hubView, setHubViewRaw] = useState<HubView>(readViewFromURL);

  const setHubView = useCallback((view: HubView) => {
    setHubViewRaw(view);

    // Sync the tab to URL search params so deep-links and back button work.
    const url = new URL(window.location.href);
    if (view === "dashboard") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", view);
    }
    window.history.pushState(null, "", url.toString());

    // Scroll to top when switching tabs.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Listen for back/forward navigation.
  useEffect(() => {
    const onPopState = () => {
      setHubViewRaw(readViewFromURL());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openChat = useCallback(
    (message: string | null = null, options: OpenChatOptions = {}) => {
      setChatInitialMessage(message || null);
      setChatAutoSend(Boolean(options.autoSend && message));
      setChatOpen(true);
    },
    [],
  );

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setChatInitialMessage(null);
    setChatAutoSend(false);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return {
    chatOpen,
    chatInitialMessage,
    chatAutoSend,
    searchOpen,
    hubView,
    setHubView,
    setSearchOpen,
    openChat,
    closeChat,
    closeSearch,
  };
}
