import express from "express";
import { existsSync } from "fs";
import { join } from "path";
import type { Handler, RequestHandler } from "express";

interface FrontendMiddlewareBundle {
  assetsStatic: Handler;
  rootStatic: Handler;
  sendIndex: RequestHandler;
}

type FrontendMiddleware = RequestHandler | FrontendMiddlewareBundle;

/**
 * SPA-serving для Replit-режиму (той самий процес хостить і API, і фронт).
 * Повертає або одну 503-middleware-функцію (коли build відсутній), або
 * пакет із трьох handler-ів, які app.js окремо монтує.
 *
 * Якщо `distPath` не існує — віддаємо 503 з підказкою, щоб не збити з пантелику
 * розробника, який запустив сервер без попереднього `npm run build`.
 */
export function createFrontendMiddleware({
  distPath,
}: {
  distPath: string;
}): FrontendMiddleware {
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
  const sendIndex: RequestHandler = (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  };
  return { assetsStatic, rootStatic, sendIndex };
}
