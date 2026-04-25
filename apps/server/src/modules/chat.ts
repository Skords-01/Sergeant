import type { Request, Response } from "express";
import { validateBody } from "../http/validate.js";
import { ChatRequestSchema } from "../http/schemas.js";
import {
  anthropicMessages,
  anthropicMessagesStream,
  extractAnthropicText,
} from "../lib/anthropic.js";
import type { WithAiQuotaRefund } from "./aiQuota.js";
import { TOOLS, SYSTEM_PREFIX } from "./chat/tools.js";

type WithAnthropicKey = Request & { anthropicKey?: string };

/**
 * Якщо Anthropic повернув не-2xx або виклик упав (timeout/abort), викликаємо
 * прикріплений `assertAiQuota` refund closure, щоб не списувати квоту за
 * неуспішний запит. Після першого виклику closure no-op (ідемпотентно).
 */
async function refundQuotaOnUpstreamFailure(req: Request): Promise<void> {
  try {
    await (req as Request & WithAiQuotaRefund).aiQuotaRefund?.();
  } catch {
    /* refund saving is best-effort, ніколи не ламає response */
  }
}

/**
 * Форма content-блоків Anthropic Messages API (Claude 4 sonnet, tool-use).
 * `text` для `type="text"`, `id/name/input` для `type="tool_use"`. Решту полів
 * лишаємо як index signature — SDK додає нові типи (`thinking`, `citations` тощо).
 */
interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  [key: string]: unknown;
}

interface AnthropicMessagesResponseData {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
  [key: string]: unknown;
}

interface ClientChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StreamEventBlockDelta {
  type: string;
  delta?: { type?: string; text?: string };
}

/**
 * POST /api/chat — основний чат з AI-асистентом з tool-calling та SSE-стрімом.
 * Middleware-и роутера гарантують ключ у `req.anthropicKey` і валідну квоту.
 */
export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const apiKey = (req as WithAnthropicKey).anthropicKey as string;

  // AbortController мапить client-disconnect (Express `req.close`) на
  // Anthropic-виклик, щоб upstream не дограв запит, на який уже ніхто не чекає
  // (і не спалив токени). Прокидається у всі виклики anthropicMessages*.
  const clientAbort = new AbortController();
  if (typeof req.on === "function") {
    req.on("close", () => {
      if (!res.writableEnded) clientAbort.abort();
    });
  }

  const parsed = validateBody(ChatRequestSchema, req, res);
  if (!parsed.ok) return;

  const {
    context = "",
    messages = [],
    tool_results,
    tool_calls_raw,
    stream,
  } = parsed.data;

  // Другий крок: клієнт виконав tool calls і повертає результати
  if (tool_results && tool_calls_raw) {
    const toolResultMessages = tool_results.map((r) => ({
      type: "tool_result" as const,
      tool_use_id: r.tool_use_id,
      content: String(r.content ?? "ok"),
    }));

    // Беремо лише останнє user-повідомлення (питання що спричинило tool call)
    const lastUserMsg = [...(Array.isArray(messages) ? messages : [])]
      .reverse()
      .find(
        (m) =>
          m?.role === "user" &&
          typeof m?.content === "string" &&
          m.content.trim(),
      );

    const fullMessages = [
      ...(lastUserMsg ? [{ role: "user", content: lastUserMsg.content }] : []),
      { role: "assistant", content: tool_calls_raw },
      { role: "user", content: toolResultMessages },
    ];

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PREFIX + context,
      tools: TOOLS,
      messages: fullMessages,
    };

    if (stream) {
      await streamAnthropicToSse(
        req,
        res,
        apiKey,
        payload,
        "chat-tool-result",
        clientAbort.signal,
      );
      return;
    }

    let response, data;
    try {
      ({ response, data } = await anthropicMessages(apiKey, payload, {
        timeoutMs: 30000,
        endpoint: "chat-tool-result",
        signal: clientAbort.signal,
      }));
    } catch (e) {
      await refundQuotaOnUpstreamFailure(req);
      throw e;
    }

    if (!response?.ok) {
      await refundQuotaOnUpstreamFailure(req);
      const errData = data as AnthropicMessagesResponseData;
      res
        .status(response?.status || 500)
        .json({ error: errData?.error?.message || "AI error" });
      return;
    }

    const text = extractAnthropicText(data as AnthropicMessagesResponseData);
    res.status(200).json({ text: text || "Готово." });
    return;
  }

  // Перший запит — може повернути tool_use або текст
  const cleaned = sanitizeMessages(messages);
  if (cleaned.length === 0) {
    res.status(400).json({ error: "Немає повідомлень" });
    return;
  }

  let response, data;
  try {
    ({ response, data } = await anthropicMessages(
      apiKey,
      {
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: SYSTEM_PREFIX + context,
        tools: TOOLS,
        messages: cleaned,
      },
      { timeoutMs: 30000, endpoint: "chat", signal: clientAbort.signal },
    ));
  } catch (e) {
    await refundQuotaOnUpstreamFailure(req);
    throw e;
  }

  if (!response?.ok) {
    await refundQuotaOnUpstreamFailure(req);
    const errData = data as AnthropicMessagesResponseData;
    res
      .status(response?.status || 500)
      .json({ error: errData?.error?.message || "AI error" });
    return;
  }

  const content: AnthropicContentBlock[] =
    (data as AnthropicMessagesResponseData)?.content || [];
  const toolUses = content.filter((b) => b.type === "tool_use");
  const textParts = content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  if (toolUses.length > 0) {
    res.status(200).json({
      text: textParts || null,
      tool_calls: toolUses.map((t) => ({
        id: t.id,
        name: t.name,
        input: t.input,
      })),
      tool_calls_raw: content,
    });
    return;
  }

  res.status(200).json({ text: textParts || "Немає відповіді від AI." });
}

/**
 * Як часто слати SSE-коментар ": ping\n\n", коли upstream мовчить.
 *
 * Контекст: Vercel/Railway/Cloudflare закривають idle HTTP-з'єднання приблизно
 * через 30-60с. Якщо Anthropic довго генерує першу токен-дельту (reasoning,
 * великий prompt, rate-limit backoff), проксі обірве SSE-сокет раніше, ніж
 * ми встигнемо щось записати — клієнт побачить "зависло" замість відповіді.
 * Heartbeat тримає сокет активним, не засмічуючи потік видимими даними
 * (коментарі `:` EventSource мовчки ігнорує).
 *
 * Env-override `SSE_HEARTBEAT_MS` — для тестів і тюнінгу під конкретний proxy.
 */
const SSE_HEARTBEAT_MS = Number(process.env.SSE_HEARTBEAT_MS) || 15_000;

/**
 * Anthropic Messages API stream → SSE для клієнта (data: {"t":"фрагмент"}).
 */
async function streamAnthropicToSse(
  req: Request,
  res: Response,
  apiKey: string,
  payload: Record<string, unknown>,
  endpoint: string = "chat",
  abortSignal?: AbortSignal,
): Promise<void> {
  let response, recordStreamEnd;
  try {
    ({ response, recordStreamEnd } = await anthropicMessagesStream(
      apiKey,
      payload,
      { endpoint, timeoutMs: 60000, signal: abortSignal },
    ));
  } catch (e) {
    await refundQuotaOnUpstreamFailure(req);
    throw e;
  }

  if (!response.ok) {
    await refundQuotaOnUpstreamFailure(req);
    let errMsg = "AI error";
    try {
      const j = (await response.json()) as AnthropicMessagesResponseData;
      errMsg = j?.error?.message || errMsg;
    } catch {
      try {
        errMsg = await response.text();
      } catch {
        /* ignore */
      }
    }
    res.status(response.status).json({ error: errMsg });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  let streamOutcome = "ok";
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = response.body?.getReader();
  if (!reader) {
    recordStreamEnd("error");
    res.status(500).json({ error: "No response body" });
    return;
  }

  // Heartbeat: чистий SSE-коментар кожні N мс, поки живе з'єднання.
  // `res.writableEnded` — щоб не писати у вже закритий потік (клієнт відвалився).
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, SSE_HEARTBEAT_MS);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const decoder = new TextDecoder();
  let lineBuf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      for (;;) {
        const nl = lineBuf.indexOf("\n");
        if (nl === -1) break;
        const line = lineBuf.slice(0, nl).replace(/\r$/, "");
        lineBuf = lineBuf.slice(nl + 1);
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        let ev: StreamEventBlockDelta;
        try {
          ev = JSON.parse(raw) as StreamEventBlockDelta;
        } catch {
          continue;
        }
        if (
          ev.type === "content_block_delta" &&
          ev.delta?.type === "text_delta" &&
          ev.delta.text
        ) {
          res.write(`data: ${JSON.stringify({ t: ev.delta.text })}\n\n`);
        }
      }
    }
  } catch (e: unknown) {
    streamOutcome = "error";
    const message = e instanceof Error ? e.message : String(e);
    res.write(`data: ${JSON.stringify({ err: message })}\n\n`);
  } finally {
    clearInterval(heartbeat);
    recordStreamEnd(streamOutcome);
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

function sanitizeMessages(messages: unknown): ClientChatMessage[] {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .filter(
      (m): m is ClientChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-12);

  // Anthropic вимагає чергування user/assistant і початок з user
  const result: ClientChatMessage[] = [];
  for (const m of cleaned) {
    if (result.length > 0 && result[result.length - 1].role === m.role)
      continue;
    result.push(m);
  }
  while (result.length > 0 && result[0].role !== "user") result.shift();
  while (result.length > 0 && result[result.length - 1].role !== "user")
    result.pop();

  return result;
}
