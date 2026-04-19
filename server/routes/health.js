import { Router } from "express";
import { createReadyzHandler, livezHandler } from "../http/index.js";
import { metricsHandler } from "../obs/metrics.js";

/**
 * Health / readiness / metrics endpoints.
 *
 * `/health` лишається аліасом для `/readyz` через історичні platform-probe-и
 * (Railway, старі Replit-пайплайни). Не видаляти без координації з деплоєм.
 *
 * @param {{ pool: import("pg").Pool }} deps
 */
export function createHealthRouter({ pool }) {
  const r = Router();
  r.get("/livez", livezHandler);
  r.get("/readyz", createReadyzHandler(pool));
  r.get("/health", createReadyzHandler(pool));
  r.get("/metrics", metricsHandler);
  return r;
}
