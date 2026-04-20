// Zod schemas (HTTP request/response + domain)
export * from "./schemas";

// Shared, DOM-free utilities (macros, date, pluralization, speech parsers)
export * from "./utils";

// Pure types (currently empty barrel for future expansion)
export * from "./types";

// Shared, DOM-free constants (storage keys, etc.)
export * from "./lib/storageKeys";

// DOM-free haptic contract (platform adapters register at app bootstrap).
export * from "./lib/haptic";

// DOM-free file-download contract (platform adapters register at app bootstrap).
export * from "./lib/fileDownload";

// DOM-free visual-keyboard-inset hook contract (platform adapters register at
// app bootstrap).
export * from "./hooks/useVisualKeyboardInset";
