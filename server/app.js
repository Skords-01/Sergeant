import express from "express";
import { existsSync } from "fs";
import { join } from "path";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { pool } from "./db.js";
import {
  apiHelmetMiddleware,
  authMetricsMiddleware,
  authSensitiveRateLimit,
  createReadyzHandler,
  errorHandler,
  livezHandler,
  requestIdMiddleware,
  requestLogMiddleware,
  withRequestContext,
} from "./httpCommon.mjs";
import { metricsHandler } from "./obs/metrics.js";
import chatHandler from "./api/chat.js";
import monoHandler from "./api/mono.js";
import privatHandler from "./api/privat.js";
import { syncPull, syncPullAll, syncPush, syncPushAll } from "./api/sync.js";
import barcodeHandler from "./api/barcode.js";
import analyzePhoto from "./api/nutrition/analyze-photo.js";
import parsePantry from "./api/nutrition/parse-pantry.js";
import refinePhoto from "./api/nutrition/refine-photo.js";
import recommendRecipes from "./api/nutrition/recommend-recipes.js";
import dayHint from "./api/nutrition/day-hint.js";
import weekPlan from "./api/nutrition/week-plan.js";
import backupUpload from "./api/nutrition/backup-upload.js";
import backupDownload from "./api/nutrition/backup-download.js";
import dayPlan from "./api/nutrition/day-plan.js";
import shoppingList from "./api/nutrition/shopping-list.js";
import weeklyDigest from "./api/weekly-digest.js";
import coachHandler from "./api/coach.js";
import {
  sendPush,
  subscribe as pushSubscribe,
  unsubscribe as pushUnsubscribe,
  vapidPublic,
} from "./api/push.js";
import foodSearchHandler from "./api/food-search.js";
import webVitalsHandler from "./api/web-vitals.js";
import { setCorsHeaders } from "./api/lib/cors.js";
import { rateLimitExpress } from "./api/lib/rateLimit.js";
import { attachSentryErrorHandler } from "./sentry.js";

/**
 * Adapts `(req, res) => Promise<void>` handlers to Express 4's error-handling
 * contract by routing any thrown/rejected error into `next(err)` so that
 * `errorHandler` can produce a uniform 4xx/5xx response.
 */
function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

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
 * Route registration order mirrors what the legacy `railway.mjs` did — the
 * previous `replit.mjs` had the same set minus `/api/push/*` (which was a
 * silent divergence bug). Unifying entrypoints fixes that automatically.
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
  app.use("/api", (req, res, next) => {
    setCorsHeaders(res, req, {
      allowHeaders: "X-Token, Content-Type",
      methods: "GET, POST, OPTIONS",
    });
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
  });

  app.get("/livez", livezHandler);
  app.get("/readyz", createReadyzHandler(pool));
  // `/health` stays as an alias of `/readyz` for legacy platform probes.
  app.get("/health", createReadyzHandler(pool));
  app.get("/metrics", metricsHandler);

  // `authMetricsMiddleware` must be registered BEFORE the rate-limiter — it
  // only attaches a `res.on("finish")` listener and calls `next()`, so even
  // when the limiter short-circuits with 429, the listener still fires on
  // response completion and the counter is incremented correctly.
  app.use("/api/auth", authMetricsMiddleware);
  app.use("/api/auth", authSensitiveRateLimit);
  app.all("/api/auth/*", toNodeHandler(auth));

  app.use(
    "/api/sync",
    rateLimitExpress({ key: "api:sync", limit: 30, windowMs: 60_000 }),
  );
  app.all("/api/sync/push", wrap(syncPush));
  app.all("/api/sync/pull", wrap(syncPull));
  app.all("/api/sync/pull-all", wrap(syncPullAll));
  app.all("/api/sync/push-all", wrap(syncPushAll));

  app.all(
    "/api/chat",
    rateLimitExpress({ key: "api:chat", limit: 30, windowMs: 60_000 }),
    wrap(chatHandler),
  );
  app.all(
    "/api/mono",
    rateLimitExpress({ key: "api:mono", limit: 60, windowMs: 60_000 }),
    wrap(monoHandler),
  );
  app.all(
    "/api/privat",
    rateLimitExpress({ key: "api:privat", limit: 30, windowMs: 60_000 }),
    wrap(privatHandler),
  );

  app.get("/api/barcode", wrap(barcodeHandler));

  // Broad best-effort limiter for nutrition endpoints (detailed limits exist inside handlers too).
  app.use(
    "/api/nutrition",
    rateLimitExpress({ key: "api:nutrition", limit: 120, windowMs: 60_000 }),
  );
  app.all("/api/nutrition/analyze-photo", wrap(analyzePhoto));
  app.all("/api/nutrition/parse-pantry", wrap(parsePantry));
  app.all("/api/nutrition/refine-photo", wrap(refinePhoto));
  app.all("/api/nutrition/recommend-recipes", wrap(recommendRecipes));
  app.all("/api/nutrition/day-hint", wrap(dayHint));
  app.all("/api/nutrition/week-plan", wrap(weekPlan));
  app.all("/api/nutrition/backup-upload", wrap(backupUpload));
  app.all("/api/nutrition/backup-download", wrap(backupDownload));
  app.all("/api/nutrition/day-plan", wrap(dayPlan));
  app.all("/api/nutrition/shopping-list", wrap(shoppingList));

  app.all(
    "/api/weekly-digest",
    rateLimitExpress({
      key: "api:weekly-digest",
      limit: 10,
      windowMs: 60 * 60_000,
    }),
    wrap(weeklyDigest),
  );

  app.use(
    "/api/coach",
    rateLimitExpress({ key: "api:coach", limit: 20, windowMs: 60 * 60_000 }),
  );
  app.all("/api/coach/memory", wrap(coachHandler));
  app.all("/api/coach/insight", wrap(coachHandler));

  app.get(
    "/api/food-search",
    rateLimitExpress({ key: "api:food-search", limit: 40, windowMs: 60_000 }),
    wrap(foodSearchHandler),
  );

  app.post(
    "/api/metrics/web-vitals",
    rateLimitExpress({ key: "api:web-vitals", limit: 60, windowMs: 60_000 }),
    wrap(webVitalsHandler),
  );

  app.get("/api/push/vapid-public", wrap(vapidPublic));
  app.use(
    "/api/push",
    rateLimitExpress({ key: "api:push", limit: 30, windowMs: 60_000 }),
  );
  app.post("/api/push/subscribe", wrap(pushSubscribe));
  app.delete("/api/push/subscribe", wrap(pushUnsubscribe));
  app.post("/api/push/send", wrap(sendPush));

  if (servesFrontend && distPath) {
    if (existsSync(distPath)) {
      app.use(
        "/assets",
        express.static(join(distPath, "assets"), {
          maxAge: "1y",
          immutable: true,
        }),
      );
      app.use(express.static(distPath, { maxAge: 0 }));
      app.get("*", (_req, res) => {
        res.sendFile(join(distPath, "index.html"));
      });
    } else {
      app.get("*", (_req, res) => {
        res
          .status(503)
          .send("Frontend not built. Run <code>npm run build</code> first.");
      });
    }
  }

  // Sentry's error handler must run before ours so it can capture stack traces
  // before we translate the error into a JSON body. Both are no-ops without
  // `SENTRY_DSN`, so this is safe in Replit-mode and local dev.
  attachSentryErrorHandler(app);
  app.use(errorHandler);

  return app;
}
