import { useCallback, useEffect, useRef, useState } from "react";

const SYNC_MODULES = {
  finyk: {
    keys: [
      "finyk_hidden", "finyk_budgets", "finyk_subs", "finyk_assets",
      "finyk_debts", "finyk_recv", "finyk_hidden_txs", "finyk_monthly_plan",
      "finyk_tx_cats", "finyk_mono_debt_linked", "finyk_networth_history",
      "finyk_tx_splits", "finyk_custom_cats_v1",
    ],
  },
  fizruk: {
    keys: [
      "fizruk_workouts_v1", "fizruk_custom_exercises_v1",
      "fizruk_measurements_v1", "fizruk_workout_templates_v1",
      "fizruk_selected_template_id_v1", "fizruk_active_workout_id_v1",
      "fizruk_plan_template_v1", "fizruk_monthly_plan_v1",
      "fizruk_wellbeing_v1",
    ],
  },
  routine: {
    keys: ["hub_routine_v1"],
  },
  nutrition: {
    keys: [
      "nutrition_log_v1", "nutrition_pantries_v1",
      "nutrition_active_pantry_v1", "nutrition_prefs_v1",
    ],
  },
};

export const SYNC_EVENT = "hub-cloud-sync-dirty";

const LAST_PUSH_TS_KEY = "hub_sync_last_push_ts";

function getLastPushTs() {
  try {
    const v = localStorage.getItem(LAST_PUSH_TS_KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

function setLastPushTs(dt) {
  try {
    localStorage.setItem(LAST_PUSH_TS_KEY, dt.toISOString());
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

export function notifySyncDirty() {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function useCloudSync(user) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const syncingRef = useRef(false);

  const pushAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const modules = {};
      for (const mod of Object.keys(SYNC_MODULES)) {
        const data = collectModuleData(mod);
        if (data && Object.keys(data).length > 0) {
          modules[mod] = { data, clientUpdatedAt: new Date().toISOString() };
        }
      }
      if (Object.keys(modules).length === 0) return;
      const res = await fetch("/api/sync/push-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) throw new Error("Push failed");
      setLastPushTs(new Date());
      setLastSync(new Date());
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, []);

  const pullAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync/pull-all", {
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
  }, []);

  const initialSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync/pull-all", {
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

      if (hasCloudData && !hasAnyLocalData) {
        for (const [mod, payload] of Object.entries(cloudModules)) {
          if (payload?.data) applyModuleData(mod, payload.data);
        }
      } else if (hasAnyLocalData && !hasCloudData) {
        const modules = {};
        for (const mod of Object.keys(SYNC_MODULES)) {
          const data = collectModuleData(mod);
          if (data && Object.keys(data).length > 0) {
            modules[mod] = { data, clientUpdatedAt: new Date().toISOString() };
          }
        }
        if (Object.keys(modules).length > 0) {
          await fetch("/api/sync/push-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ modules }),
          });
        }
      } else if (hasCloudData && hasAnyLocalData) {
        const lastPush = getLastPushTs();
        for (const [mod, payload] of Object.entries(cloudModules)) {
          if (!payload?.data) continue;
          const cloudTs = payload.serverUpdatedAt
            ? new Date(payload.serverUpdatedAt)
            : null;
          if (cloudTs && lastPush && cloudTs > lastPush) {
            applyModuleData(mod, payload.data);
          }
        }
        const modules = {};
        for (const mod of Object.keys(SYNC_MODULES)) {
          const data = collectModuleData(mod);
          if (data && Object.keys(data).length > 0) {
            modules[mod] = { data, clientUpdatedAt: new Date().toISOString() };
          }
        }
        if (Object.keys(modules).length > 0) {
          await fetch("/api/sync/push-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ modules }),
          });
        }
      }

      setLastPushTs(new Date());
      setLastSync(new Date());
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, []);

  const didInitialSync = useRef(false);
  useEffect(() => {
    if (!user || didInitialSync.current) return;
    didInitialSync.current = true;
    initialSync();
  }, [user, initialSync]);

  useEffect(() => {
    if (!user) return;
    const debounceTimer = { id: null };

    const schedulePush = () => {
      clearTimeout(debounceTimer.id);
      debounceTimer.id = setTimeout(() => {
        pushAll();
      }, 5000);
    };

    const onStorage = (e) => {
      if (!e.key) return;
      const isTracked = Object.values(SYNC_MODULES).some((m) =>
        m.keys.includes(e.key),
      );
      if (!isTracked) return;
      schedulePush();
    };

    const onSyncDirty = () => schedulePush();

    window.addEventListener("storage", onStorage);
    window.addEventListener(SYNC_EVENT, onSyncDirty);

    const periodicInterval = setInterval(() => {
      pushAll();
    }, 2 * 60 * 1000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SYNC_EVENT, onSyncDirty);
      clearTimeout(debounceTimer.id);
      clearInterval(periodicInterval);
    };
  }, [user, pushAll]);

  return { syncing, lastSync, syncError, pushAll, pullAll };
}
