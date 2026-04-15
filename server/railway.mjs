/**
 * Один процес Express для деплою API на Railway (обхід ліміту Vercel Hobby на кількість functions).
 * Шляхи збігаються з Vercel: /api/chat, /api/mono, /api/nutrition/*
 */
import express from "express";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { ensureSchema } from "./db.js";
import chatHandler from "./api/chat.js";
import monoHandler from "./api/mono.js";
import { syncPush, syncPull, syncPullAll, syncPushAll } from "./api/sync.js";
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
import { setCorsHeaders } from "./api/lib/cors.js";
import { rateLimitExpress } from "./api/lib/rateLimit.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
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

app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

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

app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) {
    const status = Number(err?.status) || 500;
    const code =
      typeof err?.code === "string"
        ? err.code
        : status === 429
          ? "RATE_LIMIT"
          : "INTERNAL";
    res.status(status).json({ error: err?.message || "Server error", code });
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
