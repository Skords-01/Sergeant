/**
 * Один процес Express для деплою API на Railway (обхід ліміту Vercel Hobby на кількість functions).
 * Шляхи збігаються з Vercel: /api/chat, /api/mono, /api/nutrition/*
 */
// ВАЖЛИВО: `./sentry.js` імпортується ПЕРШИМ, до `express`. У ESM модулі
// оцінюються в порядку їх import-оголошень (depth-first), тому `Sentry.init()`
// на module top-level у sentry.js виконається раніше за завантаження express
// та http — тільки так OpenTelemetry auto-instrumentation зможе
// монкі-патчити потрібні модулі. Детальніше: див. коментар у server/sentry.js.
import { attachSentryErrorHandler } from "./sentry.js";

import express from "express";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { ensureSchema, pool } from "./db.js";
import {
  apiHelmetMiddleware,
  authSensitiveRateLimit,
  createHealthHandler,
  requestIdMiddleware,
  requestLogMiddleware,
} from "./httpCommon.mjs";
import chatHandler from "./api/chat.js";
import monoHandler from "./api/mono.js";
import privatHandler from "./api/privat.js";
import { syncPush, syncPull, syncPullAll, syncPushAll } from "./api/sync.js";
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
  vapidPublic,
  subscribe as pushSubscribe,
  unsubscribe as pushUnsubscribe,
  sendPush,
} from "./api/push.js";
import foodSearchHandler from "./api/food-search.js";
import { setCorsHeaders } from "./api/lib/cors.js";
import { rateLimitExpress } from "./api/lib/rateLimit.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(requestIdMiddleware);
app.use(requestLogMiddleware);
app.use(apiHelmetMiddleware());
app.use(express.json({ limit: "12mb" }));

// CORS for the whole API (handlers may also set headers; safe to repeat).
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

app.get("/health", createHealthHandler(pool));

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

app.get("/api/push/vapid-public", wrap(vapidPublic));
app.use(
  "/api/push",
  rateLimitExpress({ key: "api:push", limit: 30, windowMs: 60_000 }),
);
app.post("/api/push/subscribe", wrap(pushSubscribe));
app.delete("/api/push/subscribe", wrap(pushUnsubscribe));
app.post("/api/push/send", wrap(sendPush));

// Sentry error handler має стояти перед нашим, щоб захопити stack trace.
attachSentryErrorHandler(app);

app.use((err, req, res, _next) => {
  const rid = req?.requestId;
  console.error(
    JSON.stringify({
      level: "error",
      msg: "express_error",
      requestId: rid,
      error: err?.message || String(err),
    }),
  );
  if (err?.stack) console.error(err.stack);
  if (!res.headersSent) {
    const status = Number(err?.status) || 500;
    const code =
      typeof err?.code === "string"
        ? err.code
        : status === 429
          ? "RATE_LIMIT"
          : "INTERNAL";
    res.status(status).json({
      error: err?.message || "Server error",
      code,
      requestId: rid,
    });
  }
});

ensureSchema()
  .then(() => {
    console.log("[db] Schema verified");
  })
  .catch((err) => {
    console.error("[db] Schema check failed:", err.message);
  });

app.listen(port, "0.0.0.0", () => {
  console.log(`[railway] API listening on ${port}`);
});
