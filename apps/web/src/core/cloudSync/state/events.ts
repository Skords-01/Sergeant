import { SYNC_EVENT, SYNC_STATUS_EVENT } from "../config";

export { SYNC_EVENT, SYNC_STATUS_EVENT };

export function emitStatusEvent(): void {
  try {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT));
  } catch {
    /* noop — jsdom can throw when CustomEvent is not patched */
  }
}

export function emitSyncEvent(): void {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}
