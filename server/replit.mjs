/**
 * Unified Express server for Replit.
 * Serves the built frontend static files AND all API routes on port 5000.
 */
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { ensureSchema, pool } from "./db.js";
import {
  apiHelmetMiddleware,
  authSensitiveRateLimit,
  createReadyzHandler,
  errorHandler,
  livezHandler,
  requestIdMiddleware,
  requestLogMiddleware,
  withRequestContext,
} from "./httpCommon.mjs";
import { logger } from "./obs/logger.js";
import { metricsHandler, startPoolSampler } from "./obs/metrics.js";
import chatHandler from "./api/chat.js";
import monoHandler from "./api/mono.js";
import privatHandler from "./api/privat.js";
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
import { syncPush, syncPull, syncPullAll, syncPushAll } from "./api/sync.js";
import barcodeHandler from "./api/barcode.js";
import foodSearchHandler from "./api/food-search.js";
import { setCorsHeaders } from "./api/lib/cors.js";
import { rateLimitExpress } from "./api/lib/rateLimit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.disable("x-powered-by");
app.use(requestIdMiddleware);
app.use(withRequestContext);
app.use(requestLogMiddleware);
// Replit обслуговує і API, і SPA одним процесом, тому строга API-CSP тут
// зламала б фронтенд (див. httpCommon.mjs → apiHelmetMiddleware).
app.use(apiHelmetMiddleware({ servesFrontend: true }));
app.use(express.json({ limit: "12mb" }));

app.use("/api", (req, res, next) => {
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "GET, POST, OPTIONS",
  });
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

app.get("/livez", livezHandler);
app.get("/readyz", createReadyzHandler(pool));
app.get("/health", createReadyzHandler(pool));
app.get("/metrics", metricsHandler);

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
app.get(
  "/api/food-search",
  rateLimitExpress({ key: "api:food-search", limit: 40, windowMs: 60_000 }),
  wrap(foodSearchHandler),
);

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

if (existsSync(DIST)) {
  app.use(
    "/assets",
    express.static(join(DIST, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use(express.static(DIST, { maxAge: 0 }));
  app.get("*", (_req, res) => {
    res.sendFile(join(DIST, "index.html"));
  });
} else {
  app.get("*", (_req, res) => {
    res
      .status(503)
      .send("Frontend not built. Run <code>npm run build</code> first.");
  });
}

app.use(errorHandler);

startPoolSampler(pool);

ensureSchema()
  .then(() => {
    logger.info({ msg: "db_schema_verified" });
  })
  .catch((err) => {
    logger.error({
      msg: "db_schema_check_failed",
      err: { message: err?.message || String(err), code: err?.code },
    });
  });

app.listen(port, "0.0.0.0", () => {
  logger.info({ msg: "server_listening", role: "replit", port });
});
