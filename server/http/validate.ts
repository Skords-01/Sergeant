import type { Request, Response } from "express";
import { z } from "zod";
import type { ZodTypeAny } from "zod";

export type ValidationResult<T> = { ok: true; data: T } | { ok: false };

/**
 * Валідація тіла запиту за zod-схемою.
 *
 * Повертає `{ ok: true, data }` з розпарсеним тілом або `{ ok: false }` після
 * того, як уже відправлено 400 з деталями. Обробник має одразу повернути
 * керування:
 *
 *   const parsed = validateBody(schema, req, res);
 *   if (!parsed.ok) return;
 *   const { foo } = parsed.data;
 *
 * Помилки локалізовані українською, деталі — масив `{ path, message }` для
 * клієнта, який хоче підсвітити поля.
 */
export function validateBody<S extends ZodTypeAny>(
  schema: S,
  req: Request,
  res: Response,
): ValidationResult<z.infer<S>> {
  const body = req.body ?? {};
  const result = schema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data as z.infer<S> };
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

/**
 * Те саме, але для query-параметрів (req.query).
 */
export function validateQuery<S extends ZodTypeAny>(
  schema: S,
  req: Request,
  res: Response,
): ValidationResult<z.infer<S>> {
  const query = req.query ?? {};
  const result = schema.safeParse(query);
  if (result.success) {
    return { ok: true, data: result.data as z.infer<S> };
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
