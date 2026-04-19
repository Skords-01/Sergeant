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

/**
 * POST /api/nutrition/backup-download — відновити збережений бекап.
 * CORS / token / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
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
