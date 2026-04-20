export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Як саме парсити успішну відповідь:
 * - `json` (дефолт) — `res.text()` + `JSON.parse`, кидає `ApiError { kind: "parse" }` на поганий JSON.
 * - `text` — повертає сирий текст.
 * - `raw`  — повертає `Response` без споживання body. Потрібно для SSE/стрімінгу.
 */
export type ParseMode = "json" | "text" | "raw";

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: HttpMethod;
  /**
   * Тіло запиту. Автоматично JSON.stringify для plain-обʼєктів;
   * `FormData`/`Blob`/`string`/`ArrayBuffer` передаються як є.
   */
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Дефолт — `"include"`. */
  credentials?: RequestCredentials;
  /** Дефолт — `"json"`. */
  parse?: ParseMode;
  /** Якщо задано, запит буде скасовано після N мс. Без дефолту (щоб не ламати SSE). */
  timeoutMs?: number;
}
