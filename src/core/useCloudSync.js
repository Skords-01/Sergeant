import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";

const SYNC_MODULES = {
  finyk: {
    keys: [
      "finyk_hidden", "finyk_budgets", "finyk_subs", "finyk_assets",
      "finyk_debts", "finyk_recv", "finyk_hidden_txs", "finyk_monthly_plan",
      "finyk_tx_cats", "finyk_mono_debt_linked", "finyk_networth_history",
      "finyk_tx_splits", "finyk_custom_cats_v1",
      STORAGE_KEYS.FINYK_TX_CACHE,
      STORAGE_KEYS.FINYK_INFO_CACHE,
      "finyk_tx_cache_last_good",
      STORAGE_KEYS.FINYK_SHOW_BALANCE,
      STORAGE_KEYS.FINYK_TOKEN,
    ],
  },
  fizruk: {
    keys: [
      STORAGE_KEYS.FIZRUK_WORKOUTS,
      "fizruk_custom_exercises_v1",
      STORAGE_KEYS.FIZRUK_MEASUREMENTS,
      STORAGE_KEYS.FIZRUK_TEMPLATES,
      STORAGE_KEYS.FIZRUK_SELECTED_TEMPLATE,
      "fizruk_active_workout_id_v1",
      "fizruk_plan_template_v1",
      "fizruk_monthly_plan_v1",
      STORAGE_KEYS.FIZRUK_WELLBEING,
    ],
  },
  routine: {
    keys: [STORAGE_KEYS.ROUTINE],
  },
  nutrition: {
    keys: [
      "nutrition_log_v1", "nutrition_pantries_v1",
      "nutrition_active_pantry_v1", "nutrition_prefs_v1",
    ],
  },
};

export const SYNC_EVENT = "hub-cloud-sync-dirty";

const SYNC_VERSION_KEY = "hub_sync_versions";
const DIRTY_MODULES_KEY = "hub_sync_dirty_modules";
const MODULE_MODIFIED_KEY = "hub_sync_module_modified";
const OFFLINE_QUEUE_KEY = "hub_sync_offline_queue";
const MIGRATION_DONE_KEY = "hub_sync_migrated_users";

const ALL_TRACKED_KEYS = new Set(
  Object.values(SYNC_MODULES).flatMap((m) => m.keys),
);

function keyToModule(key) {
  for (const [mod, config] of Object.entries(SYNC_MODULES)) {
    if (config.keys.includes(key)) return mod;
  }
  return null;
}

function getDirtyModules() {
  try {
    const raw = localStorage.getItem(DIRTY_MODULES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markModuleDirty(moduleName) {
  try {
    const dirty = getDirtyModules();
    dirty[moduleName] = true;
    localStorage.setItem(DIRTY_MODULES_KEY, JSON.stringify(dirty));
    const modified = getModuleModifiedTimes();
    modified[moduleName] = new Date().toISOString();
    localStorage.setItem(MODULE_MODIFIED_KEY, JSON.stringify(modified));
  } catch {
  }
}

function clearDirtyModule(moduleName) {
  try {
    const dirty = getDirtyModules();
    delete dirty[moduleName];
    localStorage.setItem(DIRTY_MODULES_KEY, JSON.stringify(dirty));
  } catch {
  }
}

function clearAllDirty() {
  try {
    localStorage.setItem(DIRTY_MODULES_KEY, JSON.stringify({}));
  } catch {
  }
}

function getModuleModifiedTimes() {
  try {
    const raw = localStorage.getItem(MODULE_MODIFIED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getModuleModifiedTime(moduleName) {
  return getModuleModifiedTimes()[moduleName] || null;
}

function getModuleVersions() {
  try {
    const raw = localStorage.getItem(SYNC_VERSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setModuleVersion(userId, moduleName, version) {
  try {
    const versions = getModuleVersions();
    if (!versions[userId]) versions[userId] = {};
    versions[userId][moduleName] = version;
    localStorage.setItem(SYNC_VERSION_KEY, JSON.stringify(versions));
  } catch {
  }
}

function getModuleVersion(userId, moduleName) {
  const versions = getModuleVersions();
  return versions[userId]?.[moduleName] ?? 0;
}

function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToOfflineQueue(entry) {
  try {
    const queue = getOfflineQueue();
    queue.push({ ...entry, ts: new Date().toISOString() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
  }
}

function clearOfflineQueue() {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
  }
}

function isMigrationDone(userId) {
  try {
    const raw = localStorage.getItem(MIGRATION_DONE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return !!map[userId];
  } catch {
    return false;
  }
}

function markMigrationDone(userId) {
  try {
    const raw = localStorage.getItem(MIGRATION_DONE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[userId] = new Date().toISOString();
    localStorage.setItem(MIGRATION_DONE_KEY, JSON.stringify(map));
  } catch {
  }
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
    } catch {
    }
  }
  return data;
}

function hasLocalData(moduleName) {
  const config = SYNC_MODULES[moduleName];
  if (!config) return false;
  for (const key of config.keys) {
    try {
      if (localStorage.getItem(key) !== null) return true;
    } catch {
    }
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
      } catch {
      }
    }
  }
}

function clearSyncManagedData() {
  for (const config of Object.values(SYNC_MODULES)) {
    for (const key of config.keys) {
      try {
        _origSetItem.call(localStorage, key, "");
        localStorage.removeItem(key);
      } catch {
      }
    }
  }
  try {
    localStorage.removeItem(DIRTY_MODULES_KEY);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    localStorage.removeItem(MODULE_MODIFIED_KEY);
  } catch {
  }
}

export function notifySyncDirty(changedKey) {
  if (changedKey && ALL_TRACKED_KEYS.has(changedKey)) {
    const mod = keyToModule(changedKey);
    if (mod) markModuleDirty(mod);
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

const _origSetItem = localStorage.setItem.bind(localStorage);
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
}

export function useCloudSync(user) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const syncingRef = useRef(false);

  const replayOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const modulesToPush = {};
    for (const entry of queue) {
      if (entry.type === "push" && entry.modules) {
        Object.assign(modulesToPush, entry.modules);
      }
    }

    if (Object.keys(modulesToPush).length > 0) {
      const res = await fetch(apiUrl("/api/sync/push-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modules: modulesToPush }),
      });
      if (res.ok) {
        clearOfflineQueue();
      }
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
    try {
      const modifiedTimes = getModuleModifiedTimes();
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
      if (user?.id && result?.results) {
        for (const [mod, r] of Object.entries(result.results)) {
          if (r?.version) setModuleVersion(user.id, mod, r.version);
          if (!r?.conflict) clearDirtyModule(mod);
        }
      }

      setLastSync(new Date());
    } catch (err) {
      const modifiedTimes = getModuleModifiedTimes();
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

      const hasCloudData = cloudModules && Object.keys(cloudModules).some(
        (m) => cloudModules[m]?.data && Object.keys(cloudModules[m].data).length > 0,
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
          const localModified = modifiedTimes[mod] ? new Date(modifiedTimes[mod]) : null;
          const cloudModified = payload.serverUpdatedAt ? new Date(payload.serverUpdatedAt) : null;

          if (cloudVersion > localVersion || (cloudModified && localModified && cloudModified > localModified)) {
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

    const periodicInterval = setInterval(() => {
      const dirty = getDirtyModules();
      if (Object.keys(dirty).length > 0) {
        pushDirty();
      }
    }, 2 * 60 * 1000);

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
