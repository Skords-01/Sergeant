/* eslint-env node, jest */
// Jest global setup for the mobile app. Registers mocks for native
// modules that can't run in the jest-expo JSDOM-like environment:
//
//   - react-native-mmkv: replaced by an in-memory shim so storage
//     helpers (`safeReadLS`, `safeWriteLS`, …) work without a native
//     TurboModule being loaded.
//   - @react-native-community/netinfo: replaced by a stub whose
//     subscription callback can be driven from tests that need to
//     simulate offline → online transitions.

jest.mock("react-native-mmkv", () => {
  class MMKV {
    constructor() {
      this._store = new Map();
    }
    set(key, value) {
      this._store.set(key, String(value));
    }
    getString(key) {
      return this._store.has(key) ? this._store.get(key) : undefined;
    }
    getNumber(key) {
      const v = this._store.get(key);
      return v === undefined ? undefined : Number(v);
    }
    getBoolean(key) {
      const v = this._store.get(key);
      if (v === undefined) return undefined;
      return v === "true";
    }
    contains(key) {
      return this._store.has(key);
    }
    delete(key) {
      this._store.delete(key);
    }
    clearAll() {
      this._store.clear();
    }
    getAllKeys() {
      return Array.from(this._store.keys());
    }
    addOnValueChangedListener() {
      return { remove: () => {} };
    }
  }
  return { MMKV };
});

jest.mock("@react-native-community/netinfo", () => {
  const listeners = new Set();
  let current = {
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  };
  return {
    __esModule: true,
    default: {
      fetch: jest.fn(() => Promise.resolve(current)),
      addEventListener: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      // Test helpers — not part of the real NetInfo API.
      __setState: (next) => {
        current = { ...current, ...next };
        for (const cb of listeners) cb(current);
      },
      __reset: () => {
        listeners.clear();
        current = {
          isConnected: true,
          isInternetReachable: true,
          type: "wifi",
        };
      },
    },
  };
});
