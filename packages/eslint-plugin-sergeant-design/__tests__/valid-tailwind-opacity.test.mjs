/**
 * Unit tests for the `sergeant-design/valid-tailwind-opacity` rule.
 *
 * Tailwind's default opacity scale steps in 5-pt increments; Sergeant's
 * preset extends it with `8` for the canonical "barely there" 8 % wash
 * (see `packages/design-tokens/tailwind-preset.js`). Any other step
 * (`/7`, `/12`, `/18`, …) silently renders **no** class and the
 * surrounding `dark:` / `hover:` override falls through, which caused
 * the dark-mode regression #814.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Linter } from "eslint";
import plugin from "../index.js";

const linter = new Linter();
const RULE_ID = "sergeant-design/valid-tailwind-opacity";

function lint(code) {
  return linter.verify(code, {
    plugins: { "sergeant-design": plugin },
    rules: { [RULE_ID]: "error" },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  });
}

describe("valid-tailwind-opacity", () => {
  it("flags `bg-finyk/7` (not in scale)", () => {
    const messages = lint(`const c = "bg-finyk/7";`);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, RULE_ID);
    assert.match(messages[0].message, /\/7/);
  });

  it("flags `dark:bg-routine/12` inside a className soup", () => {
    const messages = lint(
      `const c = "rounded-xl bg-routine-surface/40 dark:bg-routine/12 p-3";`,
    );
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /\/12/);
  });

  it("flags `text-danger/18` and `border-line/22` together", () => {
    const messages = lint(
      `const c = "text-danger/18 border-line/22 bg-panel/40";`,
    );
    assert.equal(messages.length, 2);
  });

  it("flags occurrences inside template literals", () => {
    const messages = lint(
      "const c = `flex items-center bg-primary/8 hover:bg-primary/9`;",
    );
    // `/8` is registered in the Sergeant preset; only `/9` should fire.
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /\/9/);
  });

  it("does NOT flag any of the registered steps", () => {
    const code = `
      const a = "bg-finyk/8 bg-finyk/10 bg-finyk/15";
      const b = "text-routine/40 border-line/60 ring-primary/95";
      const c = "from-finyk/0 to-finyk/100";
    `;
    const messages = lint(code);
    assert.equal(messages.length, 0);
  });

  it("does NOT flag arbitrary values like `bg-[#fff]/[.5]`", () => {
    const messages = lint(`const c = "bg-[#fff]/[.5] text-[rgb(0,0,0)]/30";`);
    assert.equal(messages.length, 0);
  });

  it("does NOT flag plain `opacity-*` utilities (different syntax)", () => {
    // `opacity-N` consults the same scale, but its missing-step failure
    // mode is loud (CSS specificity mismatch), not silent — and we don't
    // want to false-flag e.g. `opacity-50`.
    const messages = lint(`const c = "opacity-50 opacity-12";`);
    assert.equal(messages.length, 0);
  });

  it("does NOT flag dates / version strings / paths containing slashes", () => {
    const code = `
      const url = "https://example.com/api/v1/foo";
      const date = "2026-04-26 19:30/40";
      const ratio = "16/9 aspect-ratio";
    `;
    const messages = lint(code);
    assert.equal(messages.length, 0);
  });

  it("flags occurrences across `cn(…)` argument soup", () => {
    const messages = lint(
      `cn("bg-finyk/40", isActive && "bg-finyk/9", "dark:bg-finyk/8");`,
    );
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /\/9/);
  });

  it("reports the offending utility prefix in the message", () => {
    const messages = lint(`const c = "ring-primary/13";`);
    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /ring-primary\/13/);
  });
});
