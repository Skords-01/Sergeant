export { checkRateLimit } from "../../lib/rateLimit.js";

export function requireNutritionTokenIfConfigured(req, res) {
  const expected = process.env.NUTRITION_API_TOKEN;
  if (!expected) return true; // token не налаштований → нічого не ламаємо
  const got = req?.headers?.["x-token"];
  if (!got || String(got) !== String(expected)) {
    res.status(401).json({ error: "Токен відсутній або невірний" });
    return false;
  }
  return true;
}
