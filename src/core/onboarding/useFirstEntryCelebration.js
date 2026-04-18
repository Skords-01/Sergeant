// Fires a one-shot "first success" toast the render after the user logs
// their very first real entry. This is the moment the 30-second FTUX
// promise actually pays off: demo data becomes *their* data. Without a
// celebration here the transition is silent and easy to miss.
//
// Contract:
//   - Consumes the boolean returned by `detectFirstRealEntry()` (already
//     persists its own idempotency flag).
//   - Fires exactly once, client-side, per browser profile. Subsequent
//     sessions (where the flag is already persisted on mount) stay quiet.
//   - Skipped on the session where the user landed already having real
//     data — we don't want the toast to congratulate existing users.

import { useEffect, useRef } from "react";
import { useToast } from "@shared/hooks/useToast";

export function useFirstEntryCelebration(hasRealEntry) {
  // Narrow to the stable `success` callback rather than the whole
  // context value: `ToastProvider` re-memos the context on every toast
  // emission (because `toasts` is in its dep array), so depending on
  // `toast` would re-run this effect each time any toast appears or
  // dismisses anywhere in the app. `success` itself is a stable
  // `useCallback`, so this keeps the effect narrowly reactive.
  const { success } = useToast();
  const firedRef = useRef(false);
  // Snapshot the value at mount. If the user already had real data when
  // the dashboard first rendered, they're not a FTUX user — suppress the
  // celebration for good in this session.
  const initialRef = useRef(hasRealEntry);

  useEffect(() => {
    if (firedRef.current) return;
    if (initialRef.current) {
      firedRef.current = true;
      return;
    }
    if (!hasRealEntry) return;
    firedRef.current = true;
    success("Готово. Це вже твої дані.", 4000);
  }, [hasRealEntry, success]);
}
