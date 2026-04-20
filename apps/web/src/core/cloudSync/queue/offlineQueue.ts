import { safeReadLS, safeWriteLS } from "@shared/lib/storage";
import { MAX_OFFLINE_QUEUE, OFFLINE_QUEUE_KEY } from "../config";
import { emitStatusEvent } from "../state/events";
import type { QueueEntry, QueuePushEntry } from "../types";

export function getOfflineQueue(): QueueEntry[] {
  const q = safeReadLS<QueueEntry[]>(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(q) ? q : [];
}

/**
 * Append a queue entry. Consecutive `push` entries are coalesced: new module
 * payloads are merged into the last queued push instead of appending a new
 * row. This prevents queue growth and duplicate work on replay when many
 * small changes happen while offline.
 */
export function addToOfflineQueue(entry: Partial<QueuePushEntry>): void {
  let queue = getOfflineQueue();
  if (
    entry &&
    entry.type === "push" &&
    entry.modules &&
    typeof entry.modules === "object" &&
    queue.length > 0
  ) {
    const last = queue[queue.length - 1];
    if (
      last &&
      last.type === "push" &&
      last.modules &&
      typeof last.modules === "object"
    ) {
      last.modules = { ...last.modules, ...entry.modules };
      last.ts = new Date().toISOString();
      safeWriteLS(OFFLINE_QUEUE_KEY, queue);
      emitStatusEvent();
      return;
    }
  }
  queue.push({
    ...(entry as QueuePushEntry),
    ts: new Date().toISOString(),
  });
  if (queue.length > MAX_OFFLINE_QUEUE) {
    queue = queue.slice(queue.length - MAX_OFFLINE_QUEUE);
  }
  safeWriteLS(OFFLINE_QUEUE_KEY, queue);
  emitStatusEvent();
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    /* swallow */
  }
  emitStatusEvent();
}
