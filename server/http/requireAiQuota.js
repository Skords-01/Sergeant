import { assertAiQuota } from "../aiQuota.js";

/**
 * Router-middleware обгортка над `assertAiQuota`. Якщо квоту вичерпано —
 * `assertAiQuota` вже віддасть 429 через `res`; middleware тоді мовчки
 * повертає (чейн перериваэться). Інакше пропускає запит далі.
 *
 * @returns {import("express").RequestHandler}
 */
export function requireAiQuota() {
  return async (req, res, next) => {
    try {
      const ok = await assertAiQuota(req, res);
      if (!ok) return; // assertAiQuota вже відправила 429
      next();
    } catch (err) {
      next(err);
    }
  };
}
