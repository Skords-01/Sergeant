import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { safeReadLS, safeWriteLS } from "@shared/lib/storage.js";

const SYNC_MODULES = {
  finyk: {
    keys: [
      STORAGE_KEYS.FINYK_HIDDEN,
      STORAGE_KEYS.FINYK_BUDGETS,
      STORAGE_KEYS.FINYK_SUBS,
      STORAGE_KEYS.FINYK_ASSETS,
      STORAGE_KEYS.FINYK_DEBTS,
      STORAGE_KEYS.FINYK_RECV,
      STORAGE_KEYS.FINYK_HIDDEN_TXS,
      STORAGE_KEYS.FINYK_MONTHLY_PLAN,
      STORAGE_KEYS.FINYK_TX_CATS,
      STORAGE_KEYS.FINYK_MONO_DEBT_LINKED,
      STORAGE_KEYS.FINYK_NETWORTH_HISTORY,
      STORAGE_KEYS.FINYK_TX_SPLITS,
      STORAGE_KEYS.FINYK_CUSTOM_CATS,
      STORAGE_KEYS.FINYK_TX_CACHE,
      STORAGE_KEYS.FINYK_INFO_CACHE,
      STORAGE_KEYS.FINYK_TX_CACHE_LAST_GOOD,
      STORAGE_KEYS.FINYK_SHOW_BALANCE,
      STORAGE_KEYS.FINYK_TOKEN,
    ],
  },
  fizruk: {
    keys: [
      STORAGE_KEYS.FIZRUK_WORKOUTS,
      STORAGE_KEYS.FIZRUK_CUSTOM_EXERCISES,
      STORAGE_KEYS.FIZRUK_MEASUREMENTS,
      STORAGE_KEYS.FIZRUK_TEMPLATES,
      STORAGE_KEYS.FIZRUK_SELECTED_TEMPLATE,
      STORAGE_KEYS.FIZRUK_ACTIVE_WORKOUT,
      STORAGE_KEYS.FIZRUK_PLAN_TEMPLATE,
      STORAGE_KEYS.FIZRUK_MONTHLY_PLAN,
      STORAGE_KEYS.FIZRUK_WELLBEING,
    ],
  },
  routine: {
    keys: [STORAGE_KEYS.ROUTINE],
  },
  nutrition: {
    keys: [
      STORAGE_KEYS.NUTRITION_LOG,
      STORAGE_KEYS.NUTRITION_PANTRIES,
      STORAGE_KEYS.NUTRITION_ACTIVE_PANTRY,
      STORAGE_KEYS.NUTRITION_PREFS,
    ],
  },
};

export const SYNC_EVENT = "hub-cloud-sync-dirty";
export const SYNC_STATUS_EVENT = "hub-cloud-sync-status";

const SYNC_VERSION_KEY = STORAGE_KEYS.SYNC_VERSIONS;
const DIRTY_MODULES_KEY = STORAGE_KEYS.SYNC_DIRTY_MODULES;
const MODULE_MODIFIED_KEY = STORAGE_KEYS.SYNC_MODULE_MODIFIED;
const OFFLINE_QUEUE_KEY = STORAGE_KEYS.SYNC_OFFLINE_QUEUE;
const MIGRATION_DONE_KEY = STORAGE_KEYS.SYNC_MIGRATION_DONE;

// Hard cap on offline queue length. Beyond this we drop the oldest entries to
// keep localStorage usage bounded for users offline for extended periods.
const MAX_OFFLINE_QUEUE = 50;

export function __internal_parseDateSafe(value) {
  return parseDateSafe(value);
}

function parseDateSafe(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// A module push result is considered successful only when the server did not
// signal a conflict, an error, or ok:false. Any ambiguous shape is treated as
// non-success so we keep the module dirty and retry later instead of dropping
// unsynced changes.
export function __internal_isModulePushSuccess(r) {
  return isModulePushSuccess(r);
}

function isModulePushSuccess(r) {
  if (!r || typeof r !== "object") return false;
  if (r.conflict) return false;
  if (r.error) return false;
  if (r.ok === false) return false;
  return true;
}

const ALL_TRACKED_KEYS = new Set(
  Object.values(SYNC_MODULES).flatMap((m) => m.keys),
);

function keyToModule(key) {
  for (const [mod, config] of Object.entries(SYNC_MODULES)) {
    if (config.keys.includes(key)) return mod;
  }
  return null;
}

function emitStatusEvent() {
  try {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT));
  } catch {}
}

export function getDirtyModules() {
  return safeReadLS(DIRTY_MODULES_KEY, {}) || {};
}

function markModuleDirty(moduleName) {
  const dirty = getDirtyModules();
  dirty[moduleName] = true;
  safeWriteLS(DIRTY_MODULES_KEY, dirty);
  const modified = getModuleModifiedTimes();
  modified[moduleName] = new Date().toISOString();
  safeWriteLS(MODULE_MODIFIED_KEY, modified);
  emitStatusEvent();
}

function clearDirtyModule(moduleName) {
  const dirty = getDirtyModules();
  delete dirty[moduleName];
  safeWriteLS(DIRTY_MODULES_KEY, dirty);
  emitStatusEvent();
}

function clearAllDirty() {
  safeWriteLS(DIRTY_MODULES_KEY, {});
  emitStatusEvent();
}

function getModuleModifiedTimes() {
  return safeReadLS(MODULE_MODIFIED_KEY, {}) || {};
}

function getModuleVersions() {
  return safeReadLS(SYNC_VERSION_KEY, {}) || {};
}

function setModuleVersion(userId, moduleName, version) {
  const versions = getModuleVersions();
  if (!versions[userId]) versions[userId] = {};
  versions[userId][moduleName] = version;
  safeWriteLS(SYNC_VERSION_KEY, versions);
}

function getModuleVersion(userId, moduleName) {
  const versions = getModuleVersions();
  return versions[userId]?.[moduleName] ?? 0;
}

export function getOfflineQueue() {
  const q = safeReadLS(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(q) ? q : [];
}

export function __internal_addToOfflineQueue(entry) {
  return addToOfflineQueue(entry);
}

function addToOfflineQueue(entry) {
  let queue = getOfflineQueue();
  // Coalesce consecutive push entries: merge new module payloads into the last
  // queued push instead of pushing a fresh row. This prevents queue growth and
  // duplicate work on replay when many small changes happen while offline.
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
  queue.push({ ...entry, ts: new Date().toISOString() });
  if (queue.length > MAX_OFFLINE_QUEUE) {
    queue = queue.slice(queue.length - MAX_OFFLINE_QUEUE);
  }
  safeWriteLS(OFFLINE_QUEUE_KEY, queue);
  emitStatusEvent();
}

// Extract the last-known module payloads from a queue, tolerating corrupted
// rows (non-objects, wrong types, unknown module names, missing data).
// Later entries overwrite earlier ones for the same module since the queue is
// append-ordered.
export function __internal_collectQueuedModules(queue) {
  return collectQueuedModules(queue);
}

function collectQueuedModules(queue) {
  const modulesToPush = {};
  if (!Array.isArray(queue)) return modulesToPush;
  for (const entry of queue) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.type !== "push") continue;
    if (!entry.modules || typeof entry.modules !== "object") continue;
    for (const [mod, payload] of Object.entries(entry.modules)) {
      if (!SYNC_MODULES[mod]) continue;
      if (!payload || typeof payload !== "object") continue;
      modulesToPush[mod] = payload;
    }
  }
  return modulesToPush;
}

function clearOfflineQueue() {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {}
  emitStatusEvent();
}

function isMigrationDone(userId) {
  const map = safeReadLS(MIGRATION_DONE_KEY, {}) || {};
  return !!map[userId];
}

function markMigrationDone(userId) {
  const map = safeReadLS(MIGRATION_DONE_KEY, {}) || {};
  map[userId] = new Date().toISOString();
  safeWriteLS(MIGRATION_DONE_KEY, map);
}

function collectModuleData(moduleName) {
  const config = SYNC_MODULES[moduleName];
  if (!config) return null;
  const data = {};
  for (const key of config.keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    } catch {}
  }
  return data;
}

function hasLocalData(moduleName) {
  const config = SYNC_MODULES[moduleName];
  if (!config) return false;
  for (const key of config.keys) {
    try {
      if (localStorage.getItem(key) !== null) return true;
    } catch {}
  }
  return false;
}

function applyModuleData(moduleName, data) {
  if (!data || typeof data !== "object") return;
  const config = SYNC_MODULES[moduleName];
  if (!config) return;
  for (const key of config.keys) {
    if (key in data) {
      try {
        const val = data[key];
        localStorage.setItem(
          key,
          typeof val === "string" ? val : JSON.stringify(val),
        );
      } catch {}
    }
  }
}

function clearSyncManagedData() {
  for (const config of Object.values(SYNC_MODULES)) {
    for (const key of config.keys) {
      try {
        _origRemoveItem(key);
      } catch {}
    }
  }
  try {
    localStorage.removeItem(DIRTY_MODULES_KEY);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    localStorage.removeItem(MODULE_MODIFIED_KEY);
  } catch {}
}

export function notifySyncDirty(changedKey) {
  if (changedKey && ALL_TRACKED_KEYS.has(changedKey)) {
    const mod = keyToModule(changedKey);
    if (mod) markModuleDirty(mod);
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

const _origSetItem = localStorage.setItem.bind(localStorage);
const _origRemoveItem = localStorage.removeItem.bind(localStorage);
if (!window.__hubSyncPatched) {
  window.__hubSyncPatched = true;
  localStorage.setItem = function (key, value) {
    _origSetItem(key, value);
    if (ALL_TRACKED_KEYS.has(key)) {
      const mod = keyToModule(key);
      if (mod) markModuleDirty(mod);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    }
  };
  localStorage.removeItem = function (key) {
    _origRemoveItem(key);
    if (ALL_TRACKED_KEYS.has(key)) {
      const mod = keyToModule(key);
      if (mod) markModuleDirty(mod);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    }
  };
}

export function useCloudSync(user) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const syncingRef = useRef(false);
  const replayingRef = useRef(false);

  const replayOfflineQueue = useCallback(async () => {
    // Guard against re-entry: if an "online" event fires twice in quick
    // succession, or replay is triggered concurrently from initialSync and
    // pushDirty, we must not fire duplicate push requests for the same queue.
    if (replayingRef.current) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const modulesToPush = collectQueuedModules(queue);
    if (Object.keys(modulesToPush).length === 0) {
      // Queue contained only corrupted/unknown entries — drop it so we don't
      // keep retrying nothing forever.
      clearOfflineQueue();
      return;
    }

    replayingRef.current = true;
    try {
      const res = await fetch(apiUrl("/api/sync/push-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modules: modulesToPush }),
      });
      if (res.ok) {
        clearOfflineQueue();
      }
    } catch {
      // Network/transport failure during replay must not break callers
      // (onOnline chains pushDirty afterwards). Keep the queue for later.
    } finally {
      replayingRef.current = false;
    }
  }, []);

  const pushDirty = useCallback(async () => {
    if (syncingRef.current) return;
    const dirty = getDirtyModules();
    const dirtyMods = Object.keys(dirty);
    if (dirtyMods.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    // Snapshot modified timestamps at push-start. After the server responds we
    // only clear a module's dirty flag if its modifiedAt hasn't advanced —
    // otherwise a change that happened mid-request would be silently dropped.
    const modifiedSnapshot = getModuleModifiedTimes();
    const modules = {};
    for (const mod of dirtyMods) {
      const data = collectModuleData(mod);
      if (data && Object.keys(data).length > 0) {
        modules[mod] = {
          data,
          clientUpdatedAt: modifiedSnapshot[mod] || new Date().toISOString(),
        };
      }
    }
    try {
      if (Object.keys(modules).length === 0) {
        clearAllDirty();
        return;
      }

      if (!navigator.onLine) {
        addToOfflineQueue({ type: "push", modules });
        return;
      }

      await replayOfflineQueue();

      const res = await fetch(apiUrl("/api/sync/push-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) throw new Error("Push failed");

      const result = await res.json();
      const currentModified = getModuleModifiedTimes();
      if (result?.results) {
        for (const [mod, r] of Object.entries(result.results)) {
          if (user?.id && r?.version) setModuleVersion(user.id, mod, r.version);
          if (!isModulePushSuccess(r)) continue;
          // Only clear dirty if no newer change landed while we were pushing.
          if (currentModified[mod] === modifiedSnapshot[mod]) {
            clearDirtyModule(mod);
          }
        }
      }

      setLastSync(new Date());
    } catch (err) {
      // Re-queue the exact payload we attempted to push rather than
      // re-collecting, which would race with changes that happened during the
      // failed request.
      if (Object.keys(modules).length > 0) {
        addToOfflineQueue({ type: "push", modules });
      }
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [user, replayOfflineQueue]);

  const pushAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const modifiedTimes = getModuleModifiedTimes();
      const modules = {};
      for (const mod of Object.keys(SYNC_MODULES)) {
        const data = collectModuleData(mod);
        if (data && Object.keys(data).length > 0) {
          modules[mod] = {
            data,
            clientUpdatedAt: modifiedTimes[mod] || new Date().toISOString(),
          };
        }
      }
      if (Object.keys(modules).length === 0) return;

      if (!navigator.onLine) {
        addToOfflineQueue({ type: "push", modules });
        return;
      }

      const res = await fetch(apiUrl("/api/sync/push-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) throw new Error("Push failed");

      const result = await res.json();
      if (user?.id && result?.results) {
        for (const [mod, r] of Object.entries(result.results)) {
          if (r?.version) setModuleVersion(user.id, mod, r.version);
        }
      }
      clearAllDirty();
      setLastSync(new Date());
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [user]);

  const pullAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(apiUrl("/api/sync/pull-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Pull failed");
      const { modules } = await res.json();
      if (modules) {
        for (const [mod, payload] of Object.entries(modules)) {
          if (payload?.data) {
            applyModuleData(mod, payload.data);
            if (user?.id && payload.version) {
              setModuleVersion(user.id, mod, payload.version);
            }
          }
        }
      }
      setLastSync(new Date());
      return true;
    } catch (err) {
      setSyncError(err.message);
      return false;
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [user]);

  const uploadLocalData = useCallback(async () => {
    if (!user?.id) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const modifiedTimes = getModuleModifiedTimes();
      const modules = {};
      for (const mod of Object.keys(SYNC_MODULES)) {
        const data = collectModuleData(mod);
        if (data && Object.keys(data).length > 0) {
          modules[mod] = {
            data,
            clientUpdatedAt: modifiedTimes[mod] || new Date().toISOString(),
          };
        }
      }
      if (Object.keys(modules).length > 0) {
        const res = await fetch(apiUrl("/api/sync/push-all"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ modules }),
        });
        if (!res.ok) throw new Error("Upload failed");
      }
      markMigrationDone(user.id);
      clearAllDirty();
      setLastSync(new Date());
      setMigrationPending(false);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [user]);

  const skipMigration = useCallback(() => {
    if (!user?.id) return;
    markMigrationDone(user.id);
    setMigrationPending(false);
  }, [user]);

  const initialSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      await replayOfflineQueue();

      const res = await fetch(apiUrl("/api/sync/pull-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Initial sync failed");
      const { modules: cloudModules } = await res.json();

      const hasCloudData =
        cloudModules &&
        Object.keys(cloudModules).some(
          (m) =>
            cloudModules[m]?.data &&
            Object.keys(cloudModules[m].data).length > 0,
        );
      const hasAnyLocalData = Object.keys(SYNC_MODULES).some(hasLocalData);
      const migrated = isMigrationDone(user?.id);

      if (hasCloudData && !hasAnyLocalData) {
        for (const [mod, payload] of Object.entries(cloudModules)) {
          if (payload?.data) {
            applyModuleData(mod, payload.data);
            if (user?.id && payload.version) {
              setModuleVersion(user.id, mod, payload.version);
            }
          }
        }
        if (!migrated) markMigrationDone(user?.id);
      } else if (hasAnyLocalData && !hasCloudData && !migrated) {
        setMigrationPending(true);
        return;
      } else if (hasCloudData && hasAnyLocalData) {
        const modifiedTimes = getModuleModifiedTimes();
        for (const [mod, payload] of Object.entries(cloudModules)) {
          if (!payload?.data) continue;
          const localVersion = user?.id ? getModuleVersion(user.id, mod) : 0;
          const cloudVersion = payload.version ?? 0;
          const localModified = parseDateSafe(modifiedTimes[mod]);
          const cloudModified = parseDateSafe(payload.serverUpdatedAt);

          if (
            cloudVersion > localVersion ||
            (cloudModified && localModified && cloudModified > localModified)
          ) {
            applyModuleData(mod, payload.data);
          }
          if (user?.id && payload.version) {
            setModuleVersion(user.id, mod, payload.version);
          }
        }
        const dirty = getDirtyModules();
        const dirtyMods = Object.keys(dirty);
        if (dirtyMods.length > 0) {
          const modules = {};
          for (const mod of dirtyMods) {
            const data = collectModuleData(mod);
            if (data && Object.keys(data).length > 0) {
              modules[mod] = {
                data,
                clientUpdatedAt: modifiedTimes[mod] || new Date().toISOString(),
              };
            }
          }
          if (Object.keys(modules).length > 0) {
            const pushRes = await fetch(apiUrl("/api/sync/push-all"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ modules }),
            });
            if (pushRes.ok) clearAllDirty();
          }
        }
        if (!migrated) markMigrationDone(user?.id);
      } else {
        if (!migrated) markMigrationDone(user?.id);
      }

      setLastSync(new Date());
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [user, replayOfflineQueue]);

  const didInitialSync = useRef(false);
  const lastUserId = useRef(null);
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== lastUserId.current) {
      if (lastUserId.current !== null) {
        clearSyncManagedData();
      }
      didInitialSync.current = false;
      lastUserId.current = uid;
      setMigrationPending(false);
    }
    if (!user || didInitialSync.current) return;
    didInitialSync.current = true;
    initialSync();
  }, [user, initialSync]);

  useEffect(() => {
    if (!user) return;

    const onOnline = () => {
      replayOfflineQueue().then(() => pushDirty());
    };
    window.addEventListener("online", onOnline);

    const debounceTimer = { id: null };

    const schedulePush = () => {
      clearTimeout(debounceTimer.id);
      debounceTimer.id = setTimeout(() => {
        pushDirty();
      }, 5000);
    };

    const onSyncDirty = () => schedulePush();

    window.addEventListener(SYNC_EVENT, onSyncDirty);

    const periodicInterval = setInterval(
      () => {
        const dirty = getDirtyModules();
        if (Object.keys(dirty).length > 0) {
          pushDirty();
        }
      },
      2 * 60 * 1000,
    );

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_EVENT, onSyncDirty);
      clearTimeout(debounceTimer.id);
      clearInterval(periodicInterval);
    };
  }, [user, pushDirty, replayOfflineQueue]);

  return {
    syncing,
    lastSync,
    syncError,
    pushAll,
    pullAll,
    migrationPending,
    uploadLocalData,
    skipMigration,
  };
}

/**
 * Lightweight hook exposing just the local sync state (dirty modules,
 * offline queue, online status) so UI components can render status
 * indicators without owning the full cloud-sync lifecycle.
 */
export function useSyncStatus() {
  const [state, setState] = useState(() => ({
    dirtyCount: Object.keys(getDirtyModules()).length,
    queuedCount: getOfflineQueue().length,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  }));

  useEffect(() => {
    const refresh = () => {
      setState({
        dirtyCount: Object.keys(getDirtyModules()).length,
        queuedCount: getOfflineQueue().length,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      });
    };

    refresh();
    window.addEventListener(SYNC_STATUS_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener(SYNC_STATUS_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return state;
}
