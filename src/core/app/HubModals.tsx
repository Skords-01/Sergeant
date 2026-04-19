import { lazy, Suspense } from "react";

const HubSearch = lazy(() =>
  import("../HubSearch.jsx").then((m) => ({ default: m.HubSearch })),
);
const HubChat = lazy(() => import("../HubChat"));

export function HubModals({
  chatOpen,
  onCloseChat,
  chatInitialMessage,
  searchOpen,
  onCloseSearch,
  onOpenModule,
}) {
  return (
    <>
      {chatOpen && (
        <Suspense fallback={null}>
          <HubChat onClose={onCloseChat} initialMessage={chatInitialMessage} />
        </Suspense>
      )}

      {searchOpen && (
        <Suspense fallback={null}>
          <HubSearch onClose={onCloseSearch} onOpenModule={onOpenModule} />
        </Suspense>
      )}
    </>
  );
}
