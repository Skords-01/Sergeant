import express from "express";
import { existsSync } from "fs";
import { join } from "path";

/**
 * SPA-serving для Replit-режиму (той самий процес хостить і API, і фронт).
 * Повертає middleware-функцію, яку `app.js` просто прикладає наприкінці.
 *
 * Якщо `distPath` не існує — віддаємо 503 з підказкою, щоб не збити з пантелику
 * розробника, який запустив сервер без попереднього `npm run build`.
 *
 * @param {{ distPath: string }} opts
 */
export function createFrontendMiddleware({ distPath }) {
  if (!existsSync(distPath)) {
    return (_req, res) => {
      res
        .status(503)
        .send("Frontend not built. Run <code>npm run build</code> first.");
    };
  }
  const assetsStatic = express.static(join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  });
  const rootStatic = express.static(distPath, { maxAge: 0 });
  const sendIndex = (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  };
  return { assetsStatic, rootStatic, sendIndex };
}
