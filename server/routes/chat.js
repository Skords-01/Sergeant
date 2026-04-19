import { Router } from "express";
import {
  asyncHandler,
  rateLimitExpress,
  requireAiQuota,
  requireAnthropicKey,
  setModule,
} from "../http/index.js";
import chatHandler from "../modules/chat.js";

export function createChatRouter() {
  const r = Router();
  r.post(
    "/api/chat",
    setModule("chat"),
    rateLimitExpress({ key: "api:chat", limit: 30, windowMs: 60_000 }),
    requireAnthropicKey(),
    requireAiQuota(),
    asyncHandler(chatHandler),
  );
  return r;
}
