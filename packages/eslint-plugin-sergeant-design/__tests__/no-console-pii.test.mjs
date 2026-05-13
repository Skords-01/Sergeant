/**
 * Unit tests for the `sergeant-design/no-console-pii` rule.
 *
 * The rule prevents PII leaks through `console.log/error/warn/info/debug`
 * calls — DevTools, Sentry console breadcrumbs (`@sentry/react` default
 * integration) and Logpipe extensions all capture these arguments even
 * after backend redact paths scrub them.
 *
 * Audit reference: `docs/audits/2026-05-13-security-observability-roast.md` §S2.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Linter } from "eslint";
import plugin from "../index.js";

const linter = new Linter();
const RULE_ID = "sergeant-design/no-console-pii";

function lint(code, options) {
  const ruleConfig = options ? ["error", options] : "error";
  return linter.verify(code, {
    plugins: { "sergeant-design": plugin },
    rules: { [RULE_ID]: ruleConfig },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  });
}

// ── String-literal arguments (case a) — SHOULD trigger ─────────────────

describe("no-console-pii – string-literal PII keywords", () => {
  it("flags console.log with 'email' in a string literal", () => {
    const messages = lint(`console.log("user email is missing");`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
    assert.match(messages[0].message, /email/i);
  });

  it("flags console.warn with 'password' in a string literal", () => {
    const messages = lint(`console.warn("password mismatch", retries);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags console.error with 'token' in a string literal", () => {
    const messages = lint(`console.error("invalid token");`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags console.info with 'secret' in a string literal", () => {
    const messages = lint(`console.info("client secret rotated");`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags console.debug with 'phone' in a string literal", () => {
    const messages = lint(`console.debug("user phone:", normalized);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags console.log with 'authorization' in a string literal", () => {
    const messages = lint(`console.log("authorization header dump");`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags console.log with 'bearer' in a string literal", () => {
    const messages = lint(`console.log("bearer token request");`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags console.log with 'cookie' in a string literal", () => {
    const messages = lint(`console.log("cookie payload", c);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("is case-insensitive (matches 'Email')", () => {
    const messages = lint(`console.log("Email validation");`);
    assert.equal(messages.length, 1);
  });
});

// ── Template-literal arguments — SHOULD trigger ────────────────────────

describe("no-console-pii – template-literal PII keywords", () => {
  it("flags template quasi containing 'email'", () => {
    const messages = lint("console.log(`user email is ${value}`);");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags template interpolating a PII-named identifier (`${email}`)", () => {
    const messages = lint("console.log(`got ${email}`);");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags template interpolating a PII-named member (`${user.password}`)", () => {
    const messages = lint("console.log(`pw=${user.password}`);");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });
});

// ── Identifier / member-expression arguments (case b) — SHOULD trigger ──

describe("no-console-pii – PII-named identifiers and members", () => {
  it("flags bare identifier `email`", () => {
    const messages = lint(`const email = "x"; console.log(email);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags member expression `user.email`", () => {
    const messages = lint(`console.log(user.email);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags member expression `event.password`", () => {
    const messages = lint(`console.warn("auth fail", event.password);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags member expression `req.body.token`", () => {
    const messages = lint(`console.error(req.body.token);`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags `user.email.toLowerCase()` (descends into object chain)", () => {
    const messages = lint(
      `console.log("normalized:", user.email.toLowerCase());`,
    );
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags object expression property key `{ email }`", () => {
    const messages = lint(`console.log({ email: x });`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("flags object expression with string-literal PII key", () => {
    const messages = lint(`console.log({ "password": x });`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });
});

// ── Negative cases — should NOT trigger ────────────────────────────────

describe("no-console-pii – negative cases", () => {
  it("does NOT flag plain log without PII reference", () => {
    const messages = lint(`console.log("hello world");`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag log of unrelated identifier", () => {
    const messages = lint(`const x = 1; console.log(x);`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag log of unrelated object", () => {
    const messages = lint(`console.log({ requestId: id });`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag `console.table` / `console.group` (not in our 5-method set)", () => {
    const messages = lint(`console.table({ email: x });`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag non-`console` objects (`logger.log`, `pino.info`)", () => {
    const messages = lint(`logger.log({ email: x });`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag `console` member that is not a call (just reference)", () => {
    const messages = lint(`const log = console.log;`);
    assert.deepEqual(messages, []);
  });

  it("does NOT match PII keyword as a substring inside an unrelated word in a string literal", () => {
    // The regex uses `\b` so 'mailbox' should not match 'mail' — but our
    // pattern is 'email', not 'mail', so 'wholemailbox' is the right
    // mirror test. 'mailbox' does NOT contain 'email'.
    const messages = lint(`console.log("mailbox configured");`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag camelCase identifier `userEmail` (word-boundary regex per spec)", () => {
    // The PII regex uses `\b` boundaries, so `userEmail` does not match —
    // `r` and `E` are both word chars, no boundary between them. This is
    // a deliberate tradeoff to keep the rule's false-positive surface
    // low; rename to plain `email` to surface a real leak.
    const messages = lint(`const userEmail = ""; console.log(userEmail);`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag `cookie` as a property name (Pino redacts req.headers.cookie at log time)", () => {
    // `cookie` is in the STRING regex but NOT the IDENTIFIER regex — see
    // rule comment on PII_IDENT_RE.
    const messages = lint(`console.log(req.headers.cookie);`);
    assert.deepEqual(messages, []);
  });

  it("does NOT flag `authorization` as a property name", () => {
    // Same rationale as `cookie` above.
    const messages = lint(`console.log(req.headers.authorization);`);
    assert.deepEqual(messages, []);
  });
});

// ── Options.allow — escape-hatch behaviour ─────────────────────────────

describe("no-console-pii – options.allow", () => {
  it("allows a call whose first-arg matches a regex in `allow`", () => {
    const messages = lint(`console.log("[debug:dev-only]", { email: "x" });`, {
      allow: ['^"\\[debug:dev-only\\]"'],
    });
    assert.deepEqual(messages, []);
  });

  it("allows a call whose tag matches via partial regex", () => {
    const messages = lint(`console.log("[analytics-debug]", user.email);`, {
      allow: ["analytics-debug"],
    });
    assert.deepEqual(messages, []);
  });

  it("still flags calls without the allow marker even with options.allow set", () => {
    const messages = lint(`console.log("user email leak");`, {
      allow: ["unrelated-tag"],
    });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("ignores empty options.allow (defaults to [])", () => {
    const messages = lint(`console.log("password mismatch");`, { allow: [] });
    assert.equal(messages.length, 1);
  });
});

// ── Multi-argument calls — report once per call ────────────────────────

describe("no-console-pii – call shape", () => {
  it("reports once per call even with multiple PII arguments", () => {
    const messages = lint(`console.log("email", "password", { token: t });`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
  });

  it("does NOT flag calls without arguments", () => {
    const messages = lint(`console.log();`);
    assert.deepEqual(messages, []);
  });
});
