import type { HttpClient } from "../httpClient";

export interface ChatMessage {
  role: "user" | "assistant" | string;
  content: string;
}

export interface ChatRequestPayload {
  context: string;
  messages: ChatMessage[];
  tool_results?: unknown;
  tool_calls_raw?: unknown;
  stream?: boolean;
}

export interface ChatResponse {
  text?: string;
  tool_calls?: Array<{ id: string; [key: string]: unknown }>;
  tool_calls_raw?: unknown;
  error?: string;
}

export interface ChatCallOpts {
  /** Скасувати активний запит (AbortController у HubChat). */
  signal?: AbortSignal;
}

export interface ChatEndpoints {
  send: (
    payload: ChatRequestPayload,
    opts?: ChatCallOpts,
  ) => Promise<ChatResponse>;
  stream: (
    payload: ChatRequestPayload,
    opts?: ChatCallOpts,
  ) => Promise<Response>;
}

export function createChatEndpoints(http: HttpClient): ChatEndpoints {
  return {
    send: (payload, opts = {}) =>
      http.post<ChatResponse>("/api/chat", payload, { signal: opts.signal }),
    stream: (payload, opts = {}) =>
      http.raw("/api/chat", {
        method: "POST",
        body: payload,
        signal: opts.signal,
      }),
  };
}
