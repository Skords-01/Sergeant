import Redis from "ioredis";
import { logger } from "../obs/logger.js";

let _client: Redis | null = null;

export function getRedis(): Redis | null {
  return _client;
}

/**
 * Creates a Redis client from REDIS_URL if set.
 * Rate limiting falls back to in-memory when Redis is unavailable.
 */
export function connectRedis(): void {
  const url = process.env.REDIS_URL;
  if (!url) return;

  const client = new Redis(url, {
    // Fail fast per-command so the in-memory fallback kicks in quickly
    // instead of queuing commands behind a stalled connection.
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  client.on("connect", () => logger.info({ msg: "redis_connected" }));
  client.on("error", (err: Error) =>
    logger.warn({ msg: "redis_error", err: err.message }),
  );

  _client = client;
}

export async function disconnectRedis(): Promise<void> {
  if (!_client) return;
  try {
    await _client.quit();
  } catch {
    /* ignore on shutdown */
  }
  _client = null;
}
