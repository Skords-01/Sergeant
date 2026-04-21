// Zod schemas (HTTP request/response + domain)
export * from "./schemas";

// Shared, DOM-free utilities (macros, date, pluralization, speech parsers)
export * from "./utils";

// Pure types (currently empty barrel for future expansion)
export * from "./types";

// Shared, DOM-free constants (storage keys, etc.)
export * from "./lib/storageKeys";

// Hub dashboard module ordering (pure helpers; storage I/O is per-platform).
export * from "./lib/dashboard";

// Hub dashboard quick-stats preview selector (pure; callers own storage I/O).
export * from "./lib/quickStats";

// Hub weekly-digest helpers — week key / storage key / digest freshness.
export * from "./lib/weeklyDigest";

// DOM-free haptic contract (platform adapters register at app bootstrap).
export * from "./lib/haptic";

// DOM-free file-download contract (platform adapters register at app bootstrap).
export * from "./lib/fileDownload";

// DOM-free visual-keyboard-inset hook contract (platform adapters register at
// app bootstrap).
export * from "./hooks/useVisualKeyboardInset";
