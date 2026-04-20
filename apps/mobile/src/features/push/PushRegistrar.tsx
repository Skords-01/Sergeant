import { useEffect, useRef } from "react";

import { useApiClient, useUser } from "@sergeant/api-client/react";

import { registerPush } from "./registerPush";

/**
 * No-UI компонент, що монтується у root-дереві (`app/_layout.tsx`) і
 * відповідає за передачу native push-токена на сервер після логіну.
 *
 * Чому useUser, а не окремий гуард зверху: root `_layout.tsx` у expo-
 * router живе над групами `(auth)` та `(tabs)`, тож ми не можемо
 * рендерити `PushRegistrar` «фізично всередині authenticated-гілки» без
 * дублювання провайдерів. Замість цього компонент сам перевіряє статус
 * через `useUser()` і запускає `registerPush` лише коли зʼявляється
 * активний `data.user`. Після sign-out (`data.user === null`) прапорець
 * скидається, тому наступний логін знову тригерить реєстрацію (з
 * AsyncStorage-кешем у `registerPush`).
 *
 * Помилки ловимо і логуємо — пуші це побічна фіча, не ламаємо UI.
 */
export function PushRegistrar() {
  const api = useApiClient();
  const { data } = useUser();
  const userId = data?.user?.id ?? null;

  const inFlightRef = useRef(false);
  const lastRegisteredUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      lastRegisteredUserRef.current = null;
      return;
    }
    if (lastRegisteredUserRef.current === userId || inFlightRef.current) return;
    inFlightRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const result = await registerPush(api, userId);
        if (cancelled) return;
        lastRegisteredUserRef.current = userId;
        if (result.status === "registered") {
          console.info(
            `[PushRegistrar] registered ${result.platform} push token`,
          );
        } else {
          console.info(`[PushRegistrar] skipped: ${result.reason}`);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[PushRegistrar] failed to register push token", error);
        }
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, userId]);

  return null;
}
