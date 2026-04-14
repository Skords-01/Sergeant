/**
 * Один процес Express для деплою API на Railway (обхід ліміту Vercel Hobby на кількість functions).
 * Шляхи збігаються з Vercel: /api/chat, /api/mono, /api/nutrition/*
 */
import express from "express";

import chatHandler from "./api/chat.js";
import monoHandler from "./api/mono.js";
import analyzePhoto from "./api/nutrition/analyze-photo.js";
import parsePantry from "./api/nutrition/parse-pantry.js";
import refinePhoto from "./api/nutrition/refine-photo.js";
import recommendRecipes from "./api/nutrition/recommend-recipes.js";
import dayHint from "./api/nutrition/day-hint.js";
import weekPlan from "./api/nutrition/week-plan.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "12mb" }));

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

app.all("/api/chat", wrap(chatHandler));
app.all("/api/mono", wrap(monoHandler));
app.all("/api/nutrition/analyze-photo", wrap(analyzePhoto));
app.all("/api/nutrition/parse-pantry", wrap(parsePantry));
app.all("/api/nutrition/refine-photo", wrap(refinePhoto));
app.all("/api/nutrition/recommend-recipes", wrap(recommendRecipes));
app.all("/api/nutrition/day-hint", wrap(dayHint));
app.all("/api/nutrition/week-plan", wrap(weekPlan));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`[railway] API listening on ${port}`);
});
