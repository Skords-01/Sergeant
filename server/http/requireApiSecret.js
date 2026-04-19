/**
 * Guard для ендпоінтів, які викликаються лише внутрішніми cron/worker-ами:
 * очікується `X-Api-Secret` що збігається зі значенням `envVarName`. Якщо
 * секрет в env не заданий — ендпоінт недоступний (503), це свідомий вибір,
 * щоб випадково не експонувати адмінські операції у dev без секрету.
 *
 * @param {string} envVarName
 * @returns {import("express").RequestHandler}
 */
export function requireApiSecret(envVarName) {
  return (req, res, next) => {
    const expected = process.env[envVarName];
    if (!expected) {
      return res
        .status(503)
        .json({ error: "Ендпоінт не сконфігурований", code: "NOT_CONFIGURED" });
    }
    const got = req.headers["x-api-secret"];
    if (!got || String(got) !== String(expected)) {
      return res
        .status(401)
        .json({ error: "Невірний секрет", code: "UNAUTHORIZED" });
    }
    next();
  };
}
