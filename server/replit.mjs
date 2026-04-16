/**
 * Unified Express server for Replit.
 * Serves the built frontend static files AND all API routes on port 5000.
 */
import express from "express";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { ensureSchema } from "./db.js";
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
import { syncPush, syncPull, syncPullAll, syncPushAll } from "./api/sync.js";
import { setCorsHeaders } from "./api/lib/cors.js";
import { rateLimitExpress } from "./api/lib/rateLimit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.disable("x-powered-by");
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
app.all(
  "/api/privat",
  rateLimitExpress({ key: "api:privat", limit: 30, windowMs: 60_000 }),
  wrap(privatHandler),
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
      .send(
        "Frontend not built. Run <code>npm run build</code> first.",
      );
  });
}

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
  console.log(`[replit] Server listening on port ${port}`);
});
