import { randomUUID } from "crypto";

/** Клієнт може передати X-Request-Id; інакше генеруємо UUID. */
export function requestIdMiddleware(req, res, next) {
  const incoming = req.get("x-request-id")?.trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
