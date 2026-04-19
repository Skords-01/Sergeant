import { Router } from "express";
import { asyncHandler, rateLimitExpress } from "../http/index.js";
import chatHandler from "../modules/chat.js";

export function createChatRouter() {
  const r = Router();
  r.all(
    "/api/chat",
    rateLimitExpress({ key: "api:chat", limit: 30, windowMs: 60_000 }),
    asyncHandler(chatHandler),
  );
  return r;
}
