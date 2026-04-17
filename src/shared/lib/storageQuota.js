/**
 * Minimal localStorage quota guard.
 * Goal: avoid "silent" data loss on QuotaExceededError and prevent writing very large payloads.
 */

export const DEFAULT_MAX_BYTES = 4_000_000; // ~4MB safety (varies by browser)

export function estimateUtf8Bytes(str) {
  try {
    return new Blob([String(str || "")]).size;
  } catch {
    return String(str || "").length;
  }
}

export function safeSetItem(key, value, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  try {
    const s = String(value ?? "");
    const bytes = estimateUtf8Bytes(s);
    if (maxBytes && bytes > maxBytes) {
      return { ok: false, reason: "too_large", bytes, maxBytes };
    }
    localStorage.setItem(String(key), s);
    return { ok: true, bytes };
  } catch (e) {
    return { ok: false, reason: "exception", error: e };
  }
}

export function safeJsonSet(key, obj, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  try {
    const s = JSON.stringify(obj ?? null);
    return safeSetItem(key, s, { maxBytes });
  } catch (e) {
    return { ok: false, reason: "exception", error: e };
  }
}

