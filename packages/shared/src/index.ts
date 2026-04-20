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
