import { z } from "zod";
import type { Response } from "express";

interface RequestLike {
  body?: unknown;
  query?: unknown;
}

type ValidationSuccess<T> = { ok: true; data: T };
type ValidationFailure = { ok: false };

export function validateBody<T>(
  schema: z.ZodType<T>,
  req: RequestLike,
  res: Response,
): ValidationSuccess<T> | ValidationFailure {
  const body = req.body ?? {};
  const result = schema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  res.status(400).json({
    error: "Некоректні дані запиту",
    details: issues,
  });
  return { ok: false };
}

export function validateQuery<T>(
  schema: z.ZodType<T>,
  req: RequestLike,
  res: Response,
): ValidationSuccess<T> | ValidationFailure {
  const query = req.query ?? {};
  const result = schema.safeParse(query);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  res.status(400).json({
    error: "Некоректні параметри запиту",
    details: issues,
  });
  return { ok: false };
}

export { z };
