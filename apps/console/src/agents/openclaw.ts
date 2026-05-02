import {
  buildDispatcherPayload,
  dispatchToN8n,
  formatApprovalPrompt,
  type DispatcherPayload,
} from "./dispatcher.js";

export interface OpenClawEnv {
  OPENCLAW_FOUNDER_TG_USER_ID?: string;
  OPENCLAW_AGENT_DISPATCHER_WEBHOOK_URL?: string;
  N8N_AGENT_DISPATCHER_WEBHOOK_URL?: string;
  NODE_ENV?: string;
}

export interface OpenClawMessage {
  text: string;
  chatType: string;
  telegramUserId: number | undefined;
  telegramChatId: number;
  messageId: number;
}

export type OpenClawDispatcher = (
  payload: DispatcherPayload,
  env?: NodeJS.ProcessEnv,
) => Promise<string>;

export function isOpenClawFounderAllowed(
  userId: number | undefined,
  env: OpenClawEnv = process.env,
): boolean {
  if (!userId) return false;
  const founderId = env.OPENCLAW_FOUNDER_TG_USER_ID?.trim();
  if (!founderId) return false;
  return founderId === String(userId);
}

export function isOpenClawPrivateChat(chatType: string): boolean {
  return chatType === "private";
}

function stripTelegramCommand(text: string): string {
  return text.trim().replace(/^\/+/, "");
}

export function normalizeOpenClawText(text: string): string {
  const normalized = stripTelegramCommand(text);
  const lower = normalized.toLowerCase();

  if (
    lower.startsWith("status ") ||
    lower.startsWith("plan ") ||
    lower.startsWith("assign ") ||
    lower.startsWith("review ") ||
    lower.startsWith("run ") ||
    lower.startsWith("approve ") ||
    lower.startsWith("cancel ") ||
    lower.startsWith("logs ")
  ) {
    return normalized;
  }

  if (
    lower.includes("approve") ||
    lower.includes("підтвер") ||
    lower.includes("апрув")
  ) {
    return `approve ${normalized}`;
  }
  if (
    lower.includes("deploy") ||
    lower.includes("деплой") ||
    lower.includes("задеплой") ||
    lower.includes("migration") ||
    lower.includes("міграц") ||
    lower.includes("workflow")
  ) {
    return `run ${normalized}`;
  }
  if (
    lower.includes("ci") ||
    lower.includes("pr") ||
    lower.includes("review") ||
    lower.includes("перевір")
  ) {
    return `review ${normalized}`;
  }
  if (
    lower.includes("log") ||
    lower.includes("лог") ||
    lower.includes("trace")
  ) {
    return `logs ${normalized}`;
  }
  if (
    lower.includes("status") ||
    lower.includes("статус") ||
    lower.includes("стан")
  ) {
    return `status ${normalized}`;
  }
  if (
    lower.includes("assign") ||
    lower.includes("доручи") ||
    lower.includes("делегуй")
  ) {
    return `assign ${normalized}`;
  }

  return `plan ${normalized}`;
}

export function createOpenClawTask(input: {
  text: string;
  telegramUserId: number;
  telegramChatId: number;
  messageId: number;
}): DispatcherPayload {
  return buildDispatcherPayload({
    source: "openclaw",
    commandText: normalizeOpenClawText(input.text),
    telegramUserId: input.telegramUserId,
    telegramChatId: input.telegramChatId,
    messageId: input.messageId,
  });
}

function openClawDispatcherEnv(env: OpenClawEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...env,
    N8N_AGENT_DISPATCHER_WEBHOOK_URL:
      env.OPENCLAW_AGENT_DISPATCHER_WEBHOOK_URL ??
      env.N8N_AGENT_DISPATCHER_WEBHOOK_URL ??
      process.env.N8N_AGENT_DISPATCHER_WEBHOOK_URL,
  };
}

export async function runOpenClawCommand(
  message: OpenClawMessage,
  options: {
    env?: OpenClawEnv;
    dispatch?: OpenClawDispatcher;
  } = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const dispatch = options.dispatch ?? dispatchToN8n;

  if (!isOpenClawFounderAllowed(message.telegramUserId, env)) {
    return "Access denied.";
  }
  if (!isOpenClawPrivateChat(message.chatType)) {
    return "OpenClaw is available only in a private founder DM.";
  }

  const payload = createOpenClawTask({
    text: message.text,
    telegramUserId: message.telegramUserId ?? 0,
    telegramChatId: message.telegramChatId,
    messageId: message.messageId,
  });

  if (payload.requiresApproval && payload.action !== "approve") {
    return formatApprovalPrompt(payload);
  }

  return dispatch(payload, openClawDispatcherEnv(env));
}
