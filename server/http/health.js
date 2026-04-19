import { logger } from "../obs/logger.js";

/** Liveness: процес живий. Дешево і не чіпає БД. */
export function livezHandler(_req, res) {
  res.status(200).type("text/plain").send("ok");
}

/**
 * Readiness: процес готовий обслуговувати трафік. Пінгує БД; якщо БД не
 * відповідає — 503, платформа перестає маршрутизувати запити сюди.
 */
export function createReadyzHandler(pool) {
  return async (_req, res) => {
    let dbOk = false;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (e) {
      logger.error({
        msg: "readyz_db_ping_failed",
        err: { message: e?.message || String(e), code: e?.code },
      });
    }
    if (dbOk) res.status(200).type("text/plain").send("ok");
    else res.status(503).type("text/plain").send("unhealthy");
  };
}
