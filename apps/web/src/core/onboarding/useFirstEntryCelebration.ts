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
import { getTimeToValueMs } from "./vibePicks.js";

/**
 * Compose the success-moment toast. If we measured a time-to-value
 * within the 30-second window we lead with the number so the user sees
 * the promise literally kept. Outside the window (or for returning
 * users with no stamp) we fall back to the generic copy.
 *
 * @param {number | null} ttvMs
 * @returns {string}
 */
function buildToastCopy(ttvMs) {
  if (ttvMs == null) return "Готово. Це вже твої дані.";
  const sec = Math.max(1, Math.round(ttvMs / 1000));
  if (sec > 60) return "Готово. Це вже твої дані.";
  return `Готово за ${sec} с. Це вже твої дані.`;
}

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
    // `detectFirstRealEntry` ran before this effect (the dashboard
    // calls it synchronously in render), so the TTV value is already
    // persisted by the time we read it here.
    const ttv = getTimeToValueMs();
    success(buildToastCopy(ttv), 4500);
  }, [hasRealEntry, success]);
}
