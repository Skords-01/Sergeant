import { setCorsHeaders } from "../../http/cors.js";
import { setRequestModule } from "../../obs/requestContext.js";
import {
  checkRateLimit,
  requireNutritionTokenIfConfigured,
} from "./lib/nutritionSecurity.js";
import fs from "node:fs/promises";
import path from "node:path";

function safeKeyFromToken(req) {
  const tok = req?.headers?.["x-token"];
  const raw = tok ? String(tok) : "public";
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export default async function handler(req, res) {
  setRequestModule("nutrition");
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  if (!requireNutritionTokenIfConfigured(req, res)) return;
  const rl = checkRateLimit(req, {
    key: "nutrition:backup-download",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec || 60));
    return res
      .status(429)
      .json({ error: "Забагато запитів. Спробуй пізніше." });
  }

  try {
    const dir = path.join(process.cwd(), ".data");
    const key = safeKeyFromToken(req);
    const file = path.join(dir, `nutrition-backup-${key}.json`);
    const raw = await fs.readFile(file, "utf8");
    const blob = JSON.parse(raw);
    return res.status(200).json({ ok: true, blob });
  } catch {
    return res.status(404).json({ error: "Бекап не знайдено" });
  }
}
