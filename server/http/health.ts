import type { Request, RequestHandler, Response } from "express";
import { logger } from "../obs/logger.js";

interface DbPool {
  query(sql: string): Promise<unknown>;
}

/** Liveness: процес живий. Дешево і не чіпає БД. */
export function livezHandler(_req: Request, res: Response): void {
  res.status(200).type("text/plain").send("ok");
}

/**
 * Readiness: процес готовий обслуговувати трафік. Пінгує БД; якщо БД не
 * відповідає — 503, платформа перестає маршрутизувати запити сюди.
 */
export function createReadyzHandler(pool: DbPool): RequestHandler {
  return async (_req, res) => {
    let dbOk = false;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (e: unknown) {
      const err = (e && typeof e === "object" ? e : {}) as {
        message?: string;
        code?: string | number;
      };
      logger.error({
        msg: "readyz_db_ping_failed",
        err: { message: err.message || String(e), code: err.code },
      });
    }
    if (dbOk) res.status(200).type("text/plain").send("ok");
    else res.status(503).type("text/plain").send("unhealthy");
  };
}
