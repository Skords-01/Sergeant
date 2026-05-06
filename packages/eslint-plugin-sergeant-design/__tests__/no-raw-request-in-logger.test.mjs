/**
 * Unit tests for the `sergeant-design/no-raw-request-in-logger` rule.
 *
 * Forward-defense rule from stack-pulse PR-16 (Pino redaction policy).
 * Pino redact-paths in `apps/server/src/obs/logger.ts` are path-based
 * (`req.headers.authorization`, `req.body.password`); spreading or
 * re-keying the same fields would land them at the log root and bypass
 * the redact-list, so the rule blocks those shapes at lint time.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Linter } from "eslint";
import path from "node:path";
import plugin from "../index.js";

const linter = new Linter();
const RULE_ID = "sergeant-design/no-raw-request-in-logger";

// ESLint flat-config matches `files` glob relative to `process.cwd()`.
// Building filenames under cwd keeps the synthetic fixtures inside the
// matcher; the rule itself uses a substring check on the path, so the
// LOGGER_FILE_PATH_RE exemption still works.
function fixturePath(rel) {
  return path.join(process.cwd(), rel);
}

function lint(code, { filename } = {}) {
  return linter.verify(
    code,
    {
      files: ["**/*.{ts,js,mjs}"],
      plugins: { "sergeant-design": plugin },
      rules: { [RULE_ID]: "error" },
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    {
      filename: fixturePath(filename ?? "apps/server/src/routes/foo.ts"),
    },
  );
}

// ── BAD: should flag ────────────────────────────────────────────────────

describe("no-raw-request-in-logger \u2014 flags direct raw request/response", () => {
  it("flags logger.info(req)", () => {
    const messages = lint("logger.info(req);");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
    assert.match(messages[0].message, /raw `req`/);
  });

  it("flags logger.error(request)", () => {
    const messages = lint("logger.error(request);");
    assert.equal(messages.length, 1);
  });

  it("flags logger.warn(res)", () => {
    const messages = lint("logger.warn(res);");
    assert.equal(messages.length, 1);
  });

  it("flags logger.debug(response)", () => {
    const messages = lint("logger.debug(response);");
    assert.equal(messages.length, 1);
  });

  it("flags logger.fatal(req) and logger.trace(req)", () => {
    assert.equal(lint("logger.fatal(req);").length, 1);
    assert.equal(lint("logger.trace(req);").length, 1);
  });

  it("flags log.info(req) (alternate logger object name)", () => {
    assert.equal(lint("log.info(req);").length, 1);
  });

  it("flags pino.info(req) (raw pino import)", () => {
    assert.equal(lint("pino.info(req);").length, 1);
  });

  it("flags req.log.info(req) (pino-http child)", () => {
    assert.equal(lint("req.log.info(req);").length, 1);
  });

  it("flags logger.error(err, req) (req as second arg)", () => {
    assert.equal(lint("logger.error(err, req);").length, 1);
  });

  it("flags routeLogger.info(req) (heuristic 'Logger' suffix)", () => {
    assert.equal(lint("routeLogger.info(req);").length, 1);
  });
});

describe("no-raw-request-in-logger \u2014 flags spread of req/res or its parts", () => {
  it("flags logger.info({ …req })", () => {
    const messages = lint("logger.info({ …req });");
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /spread `req`/);
  });

  it("flags logger.info({ …res })", () => {
    assert.equal(lint("logger.info({ …res });").length, 1);
  });

  it("flags logger.info({ …req.body })", () => {
    const messages = lint("logger.info({ …req.body });");
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /spread `req\.body`/);
  });

  it("flags logger.info({ …req.headers })", () => {
    assert.equal(lint("logger.info({ …req.headers });").length, 1);
  });

  it("flags logger.info({ …req.cookies })", () => {
    assert.equal(lint("logger.info({ …req.cookies });").length, 1);
  });

  it("flags logger.info({ …res.body })", () => {
    assert.equal(lint("logger.info({ …res.body });").length, 1);
  });

  it("flags logger.info({ msg: 'x', …req }) (mixed)", () => {
    const messages = lint("logger.info({ msg: 'x', …req });");
    assert.equal(messages.length, 1);
  });
});

describe("no-raw-request-in-logger \u2014 flags re-keyed body/headers/cookies", () => {
  it("flags logger.info({ body: req.body })", () => {
    const messages = lint("logger.info({ body: req.body });");
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /Pino redaction is path-based/);
  });

  it("flags logger.info({ headers: req.headers })", () => {
    assert.equal(lint("logger.info({ headers: req.headers });").length, 1);
  });

  it("flags logger.info({ cookies: req.cookies })", () => {
    assert.equal(lint("logger.info({ cookies: req.cookies });").length, 1);
  });

  it("flags logger.info({ headers: res.headers })", () => {
    assert.equal(lint("logger.info({ headers: res.headers });").length, 1);
  });

  it("flags logger.info({ rawHeaders: req.rawHeaders })", () => {
    assert.equal(
      lint("logger.info({ rawHeaders: req.rawHeaders });").length,
      1,
    );
  });
});

// ── GOOD: should NOT flag ───────────────────────────────────────────────

describe("no-raw-request-in-logger \u2014 allows safe shapes", () => {
  it("allows logger.info({ req }) — canonical pino-http serializer", () => {
    assert.equal(lint("logger.info({ req });").length, 0);
  });

  it("allows logger.info({ req, res }) — canonical pair", () => {
    assert.equal(lint("logger.info({ req, res });").length, 0);
  });

  it("allows logger.info({ method: req.method, url: req.originalUrl })", () => {
    const code = "logger.info({ method: req.method, url: req.originalUrl });";
    assert.equal(lint(code).length, 0);
  });

  it("allows logger.info({ requestId, userId }) — already sanitized", () => {
    assert.equal(
      lint("logger.info({ requestId, userId, msg: 'ok' });").length,
      0,
    );
  });

  it("allows logger.info('plain string')", () => {
    assert.equal(lint("logger.info('plain string');").length, 0);
  });

  it("allows logger.info({ msg: 'x' }) — no req at all", () => {
    assert.equal(lint("logger.info({ msg: 'x' });").length, 0);
  });

  it("does NOT flag non-logger call sites", () => {
    assert.equal(lint("doSomething(req);").length, 0);
    assert.equal(lint("handler({ …req });").length, 0);
  });

  it("does NOT flag myCustomLogger.info(req) (unknown logger var name)", () => {
    // No `logger`/`log`/`pino` substring/suffix and no MemberExpression
    // with one of those — keeps the rule's false-positive surface low.
    assert.equal(lint("foo.bar.info(req);").length, 0);
  });

  it("allows arbitrary destructured object spread (not from req/res)", () => {
    const code = "logger.info({ …userMeta, requestId });";
    assert.equal(lint(code).length, 0);
  });

  it("allows logger.info({ body: payload }) (payload is not req.body)", () => {
    const code = "logger.info({ body: payload });";
    assert.equal(lint(code).length, 0);
  });
});

// ── File-scope exemption ────────────────────────────────────────────────

describe("no-raw-request-in-logger \u2014 logger.ts is exempt", () => {
  it("does NOT flag inside apps/server/src/obs/logger.ts", () => {
    const messages = lint("logger.info(req);", {
      filename: "apps/server/src/obs/logger.ts",
    });
    assert.equal(messages.length, 0);
  });

  it("does NOT flag inside apps/server/src/obs/logger.test.ts", () => {
    const messages = lint("logger.info(req);", {
      filename: "apps/server/src/obs/logger.test.ts",
    });
    assert.equal(messages.length, 0);
  });
});
