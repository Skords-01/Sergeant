import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "../ErrorBoundary";

const HubSearch = lazy(() =>
  import("../HubSearch.jsx").then((m) => ({ default: m.HubSearch })),
);
const HubChat = lazy(() => import("../HubChat"));

// Коли модалка крешиться, `ErrorBoundary` рендерить `null`, але стан
// `chatOpen` / `searchOpen` у `useHubUIState` лишається `true` — усі
// хендлери закриття (Esc, click-outside, X) живуть усередині самої
// модалки і після збою вже не рендеряться. Без явного виклику
// `onClose` користувач опиняється у "невидимій" модалці, яку не
// можна ні закрити, ні перевідкрити (React ігнорує `setChatOpen(true)`,
// бо значення вже `true`).
//
// `CloseOnError` — крихітний side-effect-only компонент: після mount
// кличе `onClose`, що очищує стан у батьківському хуку. Рендер
// `null` зберігає попередню поведінку (користувач не бачить
// поламаної модалки), але тепер без "залиплого" стану.
function CloseOnError({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

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
        <ErrorBoundary fallback={<CloseOnError onClose={onCloseChat} />}>
          <Suspense fallback={null}>
            <HubChat
              onClose={onCloseChat}
              initialMessage={chatInitialMessage}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {searchOpen && (
        <ErrorBoundary fallback={<CloseOnError onClose={onCloseSearch} />}>
          <Suspense fallback={null}>
            <HubSearch onClose={onCloseSearch} onOpenModule={onOpenModule} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
