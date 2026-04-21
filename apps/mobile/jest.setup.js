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
//   - react-native-gesture-handler: pulls in the RNGH-provided jest
//     setup so that tests relying on `Gesture.*().withTestId()` +
//     `fireGestureHandler` (see `DraggableHabitList.test.tsx`) can run
//     without a real TurboModule. Harmless for tests that don't use
//     gestures — the setup only swaps RNGH's native module for a mock.

require("react-native-gesture-handler/jestSetup");

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

// expo-router pulls in `@react-native-navigation/native` whose ESM entry
// is not transformed by jest-expo's default transform list. Tests that
// import from `expo-router` only care about the imperative API, so a
// minimal mock (`router.replace` / `router.push` / `router.back`) is
// enough for render-tests. Add fields here as tests start needing them.
jest.mock("expo-router", () => ({
  __esModule: true,
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
  },
  Link: "Link",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSearchParams: () => ({}),
  usePathname: () => "/",
  useSegments: () => [],
  Redirect: () => null,
  Stack: Object.assign(() => null, {
    Screen: () => null,
  }),
  Tabs: Object.assign(() => null, {
    Screen: () => null,
  }),
}));

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
