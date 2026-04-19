import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Обгортка над async-handler-ом для Express-роутерів. Промісові rejection-и
 * пропускаються у `next(err)`, щоб термінальний `errorHandler` міг обробити
 * їх однаково з синхронними помилками.
 *
 * Історично жила всередині `server/app.js` як `wrap()`; винесена сюди, щоб
 * нові доменні роутери могли імпортувати окремо, без циклічних залежностей.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
