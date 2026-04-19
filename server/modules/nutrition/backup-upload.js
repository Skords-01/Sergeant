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
  // tiny stable key; not a security boundary (token check happens separately)
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
    key: "nutrition:backup-upload",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec || 60));
    return res
      .status(429)
      .json({ error: "Забагато запитів. Спробуй пізніше." });
  }

  const blob = req.body?.blob;
  if (!blob || typeof blob !== "object" || Array.isArray(blob))
    return res.status(400).json({ error: "Некоректний blob" });

  // Keep it small-ish; this is encrypted client-side anyway.
  const raw = JSON.stringify(blob);
  if (raw.length > 2_500_000)
    return res.status(413).json({ error: "Бекап завеликий" });

  const dir = path.join(process.cwd(), ".data");
  await fs.mkdir(dir, { recursive: true });
  const key = safeKeyFromToken(req);
  const file = path.join(dir, `nutrition-backup-${key}.json`);
  await fs.writeFile(file, raw, "utf8");

  return res.status(200).json({ ok: true, savedAt: Date.now() });
}
