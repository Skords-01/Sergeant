/**
 * Mobile offline-queue primitive. Identical semantics to the web
 * version at `apps/web/src/core/cloudSync/queue/offlineQueue.ts`:
 *
 *   - queue is a flat array of `{type: "push", ts, modules}` rows
 *   - consecutive push rows are coalesced — newer module payloads
 *     merge into the last queued push instead of appending a new row
 *   - length is capped at `MAX_OFFLINE_QUEUE`; older rows are dropped
 *     to keep MMKV usage bounded for extended offline periods
 *
 * Backed by MMKV through the shared `@/lib/storage` adapter.
 */
import { safeReadLS, safeRemoveLS, safeWriteLS } from "@/lib/storage";
import { MAX_OFFLINE_QUEUE, OFFLINE_QUEUE_KEY } from "../config";
import { emitStatusEvent } from "../events";
import type { QueueEntry, QueuePushEntry } from "../types";

export function getOfflineQueue(): QueueEntry[] {
  const q = safeReadLS<QueueEntry[]>(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(q) ? q : [];
}

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
  safeRemoveLS(OFFLINE_QUEUE_KEY);
  emitStatusEvent();
}
