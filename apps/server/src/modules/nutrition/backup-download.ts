import fs from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import { NotFoundError } from "../../obs/errors.js";

function safeKeyFromToken(req: Request): string {
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
 *
 * Вузький catch тільки на очікувану ситуацію "файл відсутній" (ENOENT).
 * Пошкоджений JSON і файлові помилки летять наверх в errorHandler.
 */
export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  const key = safeKeyFromToken(req);
  const file = path.join(dir, `nutrition-backup-${key}.json`);

  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new NotFoundError("Бекап не знайдено");
    }
    throw e;
  }

  const blob = JSON.parse(raw);
  res.status(200).json({ ok: true, blob });
}
