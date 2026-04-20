import { ApiError } from "./ApiError";
import type { QueryValue, RequestOptions } from "./types";

const JSON_MIME = "application/json";

export type TokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export interface HttpClientConfig {
  /**
   * Базовий URL для API. Може бути:
   * - порожнім рядком → відносні шляхи (`/api/...`)
   * - повним URL (`https://api.example.com`) — для мобілки та прод-deploy-ів
   *   з API на іншому домені
   */
  baseUrl?: string;
  /**
   * Якщо надано — результат додається як `Authorization: Bearer <token>`
   * до кожного запиту. Повертає `null`/`undefined` коли токен не заданий,
   * тоді заголовок не ставимо.
   */
  getToken?: TokenProvider;
  /**
   * Кастомний `fetch` (для тестів, для RN, для проксі). За замовчуванням — `globalThis.fetch`.
   */
  fetchImpl?: typeof fetch;
  /**
   * Дефолтне `credentials` для браузерних запитів. У RN ігнорується.
   * За замовчуванням — `"include"`.
   */
  defaultCredentials?: RequestCredentials;
  /**
   * Дефолтні заголовки, що додаються до кожного запиту (після `getToken`).
   */
  defaultHeaders?: Record<string, string>;
}

export interface HttpClient {
  request: <T = unknown>(path: string, opts?: RequestOptions) => Promise<T>;
  get: <T = unknown>(path: string, opts?: RequestOptions) => Promise<T>;
  post: <T = unknown>(
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ) => Promise<T>;
  put: <T = unknown>(
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ) => Promise<T>;
  patch: <T = unknown>(
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ) => Promise<T>;
  del: <T = unknown>(
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ) => Promise<T>;
  /** Повертає сирий `Response` — для SSE/стрімінгу. */
  raw: (path: string, opts?: RequestOptions) => Promise<Response>;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

function resolveUrl(
  baseUrl: string | undefined,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const base = stripTrailingSlash(baseUrl ?? "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const full = base ? `${base}${p}` : p;
  if (!query) return full;
  const entries = Object.entries(query).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return full;
  const params = new URLSearchParams();
  for (const [k, v] of entries) params.append(k, String(v));
  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}${params.toString()}`;
}

function isBodylessInit(body: unknown): boolean {
  return (
    body == null ||
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
  );
}

function serializeBody(body: unknown): BodyInit | null | undefined {
  if (body == null) return undefined;
  if (isBodylessInit(body)) return body as BodyInit;
  return JSON.stringify(body);
}

function combineSignals(
  userSignal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal: AbortSignal | undefined; cancel: () => void } {
  if (!timeoutMs) return { signal: userSignal, cancel: () => {} };
  const ac = new AbortController();
  const onUserAbort = () => ac.abort(userSignal?.reason);
  if (userSignal) {
    if (userSignal.aborted) ac.abort(userSignal.reason);
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }
  const timer = setTimeout(() => ac.abort(new Error("timeout")), timeoutMs);
  return {
    signal: ac.signal,
    cancel: () => {
      clearTimeout(timer);
      userSignal?.removeEventListener("abort", onUserAbort);
    },
  };
}

function looksLikeJson(contentType: string | null, text: string): boolean {
  if (contentType && contentType.toLowerCase().includes(JSON_MIME)) return true;
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function safeParseJson(
  text: string,
  contentType: string | null,
): { body: unknown; parseFailed: boolean } {
  if (text.length === 0) return { body: null, parseFailed: false };
  if (!looksLikeJson(contentType, text)) {
    return { body: undefined, parseFailed: true };
  }
  try {
    return { body: JSON.parse(text), parseFailed: false };
  } catch {
    return { body: undefined, parseFailed: true };
  }
}

function networkMessage(cause: unknown): string {
  // typeof navigator — defensive: у RN `navigator` є але без `onLine`, у Node — undefined.
  if (
    typeof navigator !== "undefined" &&
    (navigator as { onLine?: boolean }).onLine === false
  ) {
    return "Немає підключення до інтернету. Спробуй пізніше.";
  }
  const msg = cause instanceof Error ? cause.message : "";
  return msg || "Мережева помилка";
}

/**
 * Створює типізований HTTP-клієнт із заданим базовим URL та опційним
 * провайдером токена. Усі endpoint-обгортки (`createSyncEndpoints` тощо)
 * працюють поверх повернутого `HttpClient`.
 */
export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  const {
    baseUrl,
    getToken,
    fetchImpl,
    defaultCredentials = "include",
    defaultHeaders,
  } = config;

  async function buildHeaders(opts: RequestOptions): Promise<Headers> {
    const h = new Headers();
    h.set("Accept", JSON_MIME);
    if (opts.body != null && !isBodylessInit(opts.body)) {
      h.set("Content-Type", JSON_MIME);
    }
    if (defaultHeaders) {
      for (const [k, v] of Object.entries(defaultHeaders)) {
        if (v !== undefined && v !== null) h.set(k, v);
      }
    }
    if (getToken) {
      try {
        const token = await getToken();
        if (token) h.set("Authorization", `Bearer ${token}`);
      } catch {
        // Якщо getToken падає — просто не додаємо заголовок.
      }
    }
    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        if (v !== undefined && v !== null) h.set(k, v);
      }
    }
    return h;
  }

  async function request<T = unknown>(
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = resolveUrl(baseUrl, path, opts.query);
    const fetchFn = fetchImpl ?? globalThis.fetch;
    const headers = await buildHeaders(opts);
    const { signal, cancel } = combineSignals(opts.signal, opts.timeoutMs);

    const init: RequestInit = {
      method: opts.method ?? (opts.body != null ? "POST" : "GET"),
      credentials: opts.credentials ?? defaultCredentials,
      headers,
      body: serializeBody(opts.body),
      signal,
    };

    let res: Response;
    try {
      res = await fetchFn(url, init);
    } catch (cause) {
      cancel();
      const name =
        cause && typeof (cause as { name?: unknown }).name === "string"
          ? (cause as { name: string }).name
          : "";
      if (name === "AbortError") {
        throw new ApiError({
          kind: "aborted",
          message: "Запит скасовано",
          url,
          cause,
        });
      }
      throw new ApiError({
        kind: "network",
        message: networkMessage(cause),
        url,
        cause,
      });
    }

    if (opts.parse === "raw") {
      cancel();
      return res as unknown as T;
    }

    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (cause) {
      cancel();
      throw new ApiError({
        kind: "network",
        message: networkMessage(cause),
        url,
        cause,
      });
    }
    cancel();

    const ct = res.headers.get("content-type");
    const { body, parseFailed } = safeParseJson(bodyText, ct);

    if (!res.ok) {
      const serverMessage =
        body && typeof body === "object"
          ? (body as { error?: unknown }).error
          : undefined;
      throw new ApiError({
        kind: "http",
        message:
          typeof serverMessage === "string" && serverMessage.length > 0
            ? serverMessage
            : `HTTP ${res.status}`,
        status: res.status,
        body,
        bodyText,
        url,
      });
    }

    if (opts.parse === "text") return bodyText as unknown as T;

    if (parseFailed) {
      throw new ApiError({
        kind: "parse",
        message: "Некоректна відповідь сервера",
        url,
        bodyText,
      });
    }

    return body as T;
  }

  return {
    request,
    get<T = unknown>(path: string, opts?: RequestOptions) {
      return request<T>(path, { ...opts, method: "GET" });
    },
    post<T = unknown>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>(path, { ...opts, method: "POST", body });
    },
    put<T = unknown>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>(path, { ...opts, method: "PUT", body });
    },
    patch<T = unknown>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>(path, { ...opts, method: "PATCH", body });
    },
    del<T = unknown>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>(path, { ...opts, method: "DELETE", body });
    },
    raw(path: string, opts?: RequestOptions) {
      return request<Response>(path, { ...opts, parse: "raw" });
    },
  };
}
