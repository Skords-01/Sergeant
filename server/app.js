import express from "express";

import { pool } from "./db.js";
import {
  apiCorsMiddleware,
  apiHelmetMiddleware,
  errorHandler,
  requestIdMiddleware,
  requestLogMiddleware,
  withRequestContext,
} from "./http/index.js";
import { registerRoutes } from "./routes/index.js";
import { createFrontendMiddleware } from "./routes/frontend.js";
import { attachSentryErrorHandler } from "./sentry.js";

/**
 * @typedef {Object} CreateAppOptions
 * @property {boolean} [servesFrontend=false]
 *   If true, CSP is disabled and the built SPA from `distPath` is served.
 *   Used by the Replit deploy where one process hosts both API and frontend.
 * @property {string|null} [distPath=null]
 *   Absolute path to the Vite build output (the folder containing `index.html`).
 *   Required when `servesFrontend=true`.
 * @property {number|boolean|undefined} [trustProxy=1]
 *   Forwarded to `app.set('trust proxy', …)`. Pass `undefined` to skip (Replit
 *   historically did not configure this).
 */

/**
 * Construct a fully-wired Express application.
 *
 * This factory is environment-agnostic: it reads nothing from `process.env` and
 * does not call `app.listen()`. The caller (`server/index.js`) is responsible
 * for bootstrapping Sentry, process-level handlers, and starting the HTTP
 * listener. Keeping `createApp` pure makes it trivial to smoke-test routes in
 * Vitest without spinning up a real server.
 *
 * Routing itself is delegated to `server/routes/` — per-domain routers are
 * mounted through `registerRoutes`. The order matters and is preserved there.
 *
 * @param {CreateAppOptions} [opts]
 * @returns {import("express").Express}
 */
export function createApp({
  servesFrontend = false,
  distPath = null,
  trustProxy = 1,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (trustProxy !== undefined && trustProxy !== false) {
    app.set("trust proxy", trustProxy);
  }

  app.use(requestIdMiddleware);
  app.use(withRequestContext);
  app.use(requestLogMiddleware);
  app.use(apiHelmetMiddleware({ servesFrontend }));
  app.use(express.json({ limit: "12mb" }));

  // Global CORS for the whole /api surface. Individual handlers may re-set
  // headers (e.g. to widen allow-headers) — `setCorsHeaders` is idempotent.
  app.use("/api", apiCorsMiddleware());

  registerRoutes(app, { pool });

  if (servesFrontend && distPath) {
    const fe = createFrontendMiddleware({ distPath });
    if (typeof fe === "function") {
      app.get("*", fe);
    } else {
      app.use("/assets", fe.assetsStatic);
      app.use(fe.rootStatic);
      app.get("*", fe.sendIndex);
    }
  }

  // Sentry's error handler must run before ours so it can capture stack traces
  // before we translate the error into a JSON body. Both are no-ops without
  // `SENTRY_DSN`, so this is safe in Replit-mode and local dev.
  attachSentryErrorHandler(app);
  app.use(errorHandler);

  return app;
}
