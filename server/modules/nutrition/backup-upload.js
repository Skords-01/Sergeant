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

/**
 * POST /api/nutrition/backup-upload — залити шифрований бекап.
 * CORS / token / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
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
