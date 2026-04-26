/**
 * sergeant-design — local ESLint plugin for Sergeant design-system guardrails.
 *
 * Rules:
 *   - no-eyebrow-drift: forbid the combination of `uppercase`, `tracking-*`,
 *     and `text-*` in a single className string. Use <SectionHeading> (or
 *     <Label normalCase={false}>) instead. Add
 *       // eslint-disable-next-line sergeant-design/no-eyebrow-drift
 *     for intentional stylistic exceptions (e.g. narrative overlay stories).
 *
 *   - no-ellipsis-dots: forbid three consecutive ASCII dots (`...`) inside
 *     string literals and JSX text nodes — the typographic ellipsis `…`
 *     (U+2026) is a single glyph, renders with correct kerning, and is
 *     what Web Interface Guidelines recommend for truncation cues
 *     ("Loading…", "Пошук…", etc.). Auto-fixable.
 */

const EYEBROW_MESSAGE =
  "Avoid the `uppercase` + `tracking-*` + `text-*` eyebrow combo in raw classNames — use <SectionHeading> (or <Label>) instead. Add // eslint-disable-next-line sergeant-design/no-eyebrow-drift only for intentional narrative / overlay typography.";

// A className triggers the rule iff it contains all three markers.
const RX_UPPERCASE = /(?:^|\s)uppercase(?:\s|$)/;
const RX_TRACKING = /(?:^|\s)tracking-[\w-]+/;
// Match any `text-*` utility (size OR color) — the drift is specifically the
// colocation with `uppercase` + `tracking-`, regardless of which `text-*`.
const RX_TEXT = /(?:^|\s)text-[\w-]+(?:\/\d+)?(?:\s|$)/;

function classNameHasEyebrowDrift(value) {
  if (typeof value !== "string") return false;
  return (
    RX_UPPERCASE.test(value) && RX_TRACKING.test(value) && RX_TEXT.test(value)
  );
}

const noEyebrowDrift = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid the uppercase+tracking+text eyebrow combo outside the <SectionHeading> / <Label> design-system primitives.",
    },
    schema: [],
    messages: { drift: EYEBROW_MESSAGE },
  },
  create(context) {
    function report(node, value) {
      if (classNameHasEyebrowDrift(value)) {
        context.report({ node, messageId: "drift" });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") report(node, node.value);
      },
      TemplateElement(node) {
        if (node.value && typeof node.value.cooked === "string") {
          report(node, node.value.cooked);
        } else if (node.value && typeof node.value.raw === "string") {
          report(node, node.value.raw);
        }
      },
    };
  },
};

const ELLIPSIS_MESSAGE =
  "Use `…` (U+2026, a single ellipsis glyph) instead of three ASCII dots `...` in user-facing strings. The typographic ellipsis renders with correct kerning and is what Web Interface Guidelines recommend for truncation cues (e.g. 'Loading…').";

const RX_THREE_DOTS = /\.{3}/;

function replaceEllipsisDots(text) {
  return text.replace(/\.{3}/g, "…");
}

const noEllipsisDots = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Forbid three ASCII dots (`...`) inside string literals — use the typographic ellipsis `…` (U+2026).",
    },
    fixable: "code",
    schema: [],
    messages: { ellipsis: ELLIPSIS_MESSAGE },
  },
  create(context) {
    function reportLiteral(node, raw) {
      if (!RX_THREE_DOTS.test(raw)) return;
      context.report({
        node,
        messageId: "ellipsis",
        fix(fixer) {
          const sourceCode = context.sourceCode ?? context.getSourceCode();
          const text = sourceCode.getText(node);
          return fixer.replaceText(node, replaceEllipsisDots(text));
        },
      });
    }
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        reportLiteral(node, node.value);
      },
      TemplateElement(node) {
        const raw = node.value && node.value.cooked;
        if (typeof raw !== "string") return;
        reportLiteral(node, raw);
      },
      JSXText(node) {
        if (typeof node.value !== "string") return;
        if (!RX_THREE_DOTS.test(node.value)) return;
        context.report({
          node,
          messageId: "ellipsis",
          fix(fixer) {
            return fixer.replaceText(node, replaceEllipsisDots(node.value));
          },
        });
      },
    };
  },
};

// ─── no-raw-tracked-storage ─────────────────────────────────────────────
//
// Background
// ----------
// On mobile, MMKV writes bypass JS, so a hook that calls raw
// `useLocalStorage` with a key registered in
// `apps/mobile/src/sync/config.ts → SYNC_MODULES` will silently break
// cloud sync — the exact regression that bit Finyk and Fizruk before
// `useSyncedStorage` was introduced. The warning in
// `apps/mobile/src/lib/storage.ts` is documentary; this rule makes the
// safety mechanical.
//
// The rule fires when:
//   - the callee is `useLocalStorage` (identifier, regardless of import
//     source — the mobile app re-exports it from `@/lib/storage`), and
//   - the first argument is either a string literal whose value is one
//     of the tracked MMKV key strings, OR a `STORAGE_KEYS.<NAME>`
//     member expression where `<NAME>` is one of the tracked names
//     listed in `SYNC_MODULES`.
//
// Tracked names + values are mirrored verbatim from
// `apps/mobile/src/sync/config.ts` and
// `packages/shared/src/lib/storageKeys.ts`. The companion test
// `__tests__/no-raw-tracked-storage.parity.test.mjs` reads both source
// files and fails CI if the rule's set drifts from them, so a new
// tracked key cannot be added to `SYNC_MODULES` without updating the
// rule (or vice versa).

const TRACKED_STORAGE_KEY_NAMES = new Set([
  // finyk
  "FINYK_HIDDEN",
  "FINYK_BUDGETS",
  "FINYK_SUBS",
  "FINYK_ASSETS",
  "FINYK_DEBTS",
  "FINYK_RECV",
  "FINYK_HIDDEN_TXS",
  "FINYK_MONTHLY_PLAN",
  "FINYK_TX_CATS",
  "FINYK_MONO_DEBT_LINKED",
  "FINYK_NETWORTH_HISTORY",
  "FINYK_TX_SPLITS",
  "FINYK_CUSTOM_CATS",
  "FINYK_TX_CACHE",
  "FINYK_INFO_CACHE",
  "FINYK_TX_CACHE_LAST_GOOD",
  "FINYK_SHOW_BALANCE",
  "FINYK_TOKEN",
  "FINYK_MANUAL_EXPENSES",
  "FINYK_TX_FILTERS",
  // fizruk
  "FIZRUK_WORKOUTS",
  "FIZRUK_CUSTOM_EXERCISES",
  "FIZRUK_MEASUREMENTS",
  "FIZRUK_TEMPLATES",
  "FIZRUK_SELECTED_TEMPLATE",
  "FIZRUK_ACTIVE_WORKOUT",
  "FIZRUK_ACTIVE_PROGRAM",
  "FIZRUK_PLAN_TEMPLATE",
  "FIZRUK_MONTHLY_PLAN",
  "FIZRUK_WELLBEING",
  // routine
  "ROUTINE",
  // nutrition
  "NUTRITION_LOG",
  "NUTRITION_PANTRIES",
  "NUTRITION_ACTIVE_PANTRY",
  "NUTRITION_PREFS",
  "NUTRITION_SAVED_RECIPES",
]);

const TRACKED_STORAGE_KEY_VALUES = new Set([
  // finyk
  "finyk_hidden",
  "finyk_budgets",
  "finyk_subs",
  "finyk_assets",
  "finyk_debts",
  "finyk_recv",
  "finyk_hidden_txs",
  "finyk_monthly_plan",
  "finyk_tx_cats",
  "finyk_mono_debt_linked",
  "finyk_networth_history",
  "finyk_tx_splits",
  "finyk_custom_cats_v1",
  "finyk_tx_cache",
  "finyk_info_cache",
  "finyk_tx_cache_last_good",
  "finyk_show_balance_v1",
  "finyk_token",
  "finyk_manual_expenses_v1",
  "finyk_tx_filters_v1",
  // fizruk
  "fizruk_workouts_v1",
  "fizruk_custom_exercises_v1",
  "fizruk_measurements_v1",
  "fizruk_workout_templates_v1",
  "fizruk_selected_template_id_v1",
  "fizruk_active_workout_id_v1",
  "fizruk_active_program_id_v1",
  "fizruk_plan_template_v1",
  "fizruk_monthly_plan_v1",
  "fizruk_wellbeing_v1",
  // routine
  "hub_routine_v1",
  // nutrition
  "nutrition_log_v1",
  "nutrition_pantries_v1",
  "nutrition_active_pantry_v1",
  "nutrition_prefs_v1",
  "nutrition_recipe_book_v1",
]);

const RAW_TRACKED_STORAGE_MESSAGE =
  "`useLocalStorage` was called with a key tracked in `apps/mobile/src/sync/config.ts → SYNC_MODULES`. Raw MMKV writes bypass cloud-sync wiring; use `useSyncedStorage` from `@/sync/useSyncedStorage` instead so the change is enqueued automatically.";

function isTrackedKeyArgument(arg) {
  if (!arg) return false;
  // Plain string literal: useLocalStorage("finyk_budgets", …)
  if (arg.type === "Literal" && typeof arg.value === "string") {
    return TRACKED_STORAGE_KEY_VALUES.has(arg.value);
  }
  // Template literal with no expressions: useLocalStorage(`finyk_budgets`, …)
  if (
    arg.type === "TemplateLiteral" &&
    arg.expressions.length === 0 &&
    arg.quasis.length === 1
  ) {
    const cooked = arg.quasis[0].value && arg.quasis[0].value.cooked;
    if (typeof cooked === "string") {
      return TRACKED_STORAGE_KEY_VALUES.has(cooked);
    }
  }
  // Member access: useLocalStorage(STORAGE_KEYS.FINYK_BUDGETS, …)
  if (
    arg.type === "MemberExpression" &&
    !arg.computed &&
    arg.object.type === "Identifier" &&
    arg.object.name === "STORAGE_KEYS" &&
    arg.property.type === "Identifier"
  ) {
    return TRACKED_STORAGE_KEY_NAMES.has(arg.property.name);
  }
  // Bracket access with a literal key: STORAGE_KEYS["FINYK_BUDGETS"]
  if (
    arg.type === "MemberExpression" &&
    arg.computed &&
    arg.object.type === "Identifier" &&
    arg.object.name === "STORAGE_KEYS" &&
    arg.property.type === "Literal" &&
    typeof arg.property.value === "string"
  ) {
    return TRACKED_STORAGE_KEY_NAMES.has(arg.property.value);
  }
  return false;
}

const noRawTrackedStorage = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid `useLocalStorage` calls on mobile when the key is registered in SYNC_MODULES — use `useSyncedStorage` so the write is mirrored to the cloud-sync queue.",
    },
    schema: [],
    messages: { rawTracked: RAW_TRACKED_STORAGE_MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        const isUseLocalStorage =
          (callee.type === "Identifier" && callee.name === "useLocalStorage") ||
          (callee.type === "MemberExpression" &&
            !callee.computed &&
            callee.property.type === "Identifier" &&
            callee.property.name === "useLocalStorage");
        if (!isUseLocalStorage) return;
        if (!node.arguments || node.arguments.length === 0) return;
        if (isTrackedKeyArgument(node.arguments[0])) {
          context.report({ node, messageId: "rawTracked" });
        }
      },
    };
  },
};

// ─── ai-marker-syntax ───────────────────────────────────────────────────
//
// Validates AI code-marker comments follow the canonical syntax defined in
// docs/ai-coding-improvements.md §3.1. Exactly four markers are allowed:
//
//   // AI-NOTE: <text>
//   // AI-DANGER: <text>
//   // AI-GENERATED: <generator>
//   // AI-LEGACY: expires YYYY-MM-DD
//
// The rule scans all comments (line and block) looking for strings that
// *almost* match one of these markers — e.g. `AI-NOTES`, `AINOTE`,
// `AI_NOTE`, or a valid prefix missing the colon — and reports them as
// malformed. Well-formed markers are silently accepted.

// A line within a comment is a valid AI marker if it starts (after
// optional whitespace / block-comment stars) with one of the four
// canonical prefixes followed by a colon and a space.
const VALID_LINE_RE = /^[\s/*]*AI-(NOTE|DANGER|GENERATED|LEGACY):\s/;

// A line within a comment looks like a *malformed* AI marker attempt if
// it starts (after optional whitespace / stars) with something close to
// a canonical marker but not quite right — typos like `AI-NOTES`,
// `AINOTE`, `AI_NOTE`, or a valid prefix missing the colon.
// Only anchored-to-start matches count; "AI-generated" in the middle of
// prose (e.g. "the AI-generated digest") is intentionally ignored.
const MALFORMED_LINE_RE =
  /^[\s/*]*AI[-_\s]?(NOTES?|DANGERS?|GENERATED|LEGACY)\b/i;

const AI_MARKER_MESSAGE =
  'Malformed AI marker: "{{text}}". Valid markers are: // AI-NOTE: …, // AI-DANGER: …, // AI-GENERATED: …, // AI-LEGACY: …';

const aiMarkerSyntax = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Validate AI code-marker comments follow the canonical syntax (AI-NOTE:, AI-DANGER:, AI-GENERATED:, AI-LEGACY:). Catches typos like AI-NOTES, AINOTE, AI_NOTE, or missing colons.",
    },
    schema: [],
    messages: { malformed: AI_MARKER_MESSAGE },
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();
        for (const comment of comments) {
          const lines = comment.value.split("\n");
          for (const line of lines) {
            if (!MALFORMED_LINE_RE.test(line)) continue;
            if (VALID_LINE_RE.test(line)) continue;
            const match = line.match(MALFORMED_LINE_RE);
            context.report({
              loc: comment.loc,
              messageId: "malformed",
              data: { text: match[0].trim() },
            });
          }
        }
      },
    };
  },
};

// ─── no-raw-local-storage ───────────────────────────────────────────────
//
// On the web app, every direct `localStorage.*` access is a hazard:
// JSON.parse of corrupted contents throws, `setItem` throws on
// QuotaExceededError, and the whole API throws in private-browsing
// Safari. The shared helpers (`safeReadLS` / `safeWriteLS` from
// `@shared/lib/storage`, `useLocalStorageState` from
// `@shared/hooks/useLocalStorageState`, and `createModuleStorage` from
// `@shared/lib/createModuleStorage`) wrap these calls with try/catch and
// quota fallbacks, and they're the integration boundary tests already
// mock.
//
// This rule blocks raw `localStorage.foo` and `window.localStorage.foo`
// member access. Files that legitimately implement the wrappers above —
// or that haven't been migrated yet — opt out via the eslint.config
// override list, NOT via inline disables, so the migration list stays
// greppable in one place.

const RAW_LOCAL_STORAGE_MESSAGE =
  "Direct `localStorage` access throws on quota / private-browsing / corrupt JSON. Use `safeReadLS` / `safeWriteLS` from `@shared/lib/storage`, the `useLocalStorageState` hook, or `createModuleStorage` so failures are handled and tests can mock the boundary.";

function isLocalStorageMember(node) {
  if (!node || node.type !== "MemberExpression") return false;
  // Direct: `localStorage.foo` / `localStorage["foo"]`
  if (
    node.object.type === "Identifier" &&
    node.object.name === "localStorage"
  ) {
    return true;
  }
  // `window.localStorage.foo` / `globalThis.localStorage.foo` (the chain
  // shows up as a MemberExpression whose `object` is itself a
  // MemberExpression resolving to `localStorage`).
  if (
    node.object.type === "MemberExpression" &&
    !node.object.computed &&
    node.object.property.type === "Identifier" &&
    node.object.property.name === "localStorage" &&
    node.object.object.type === "Identifier" &&
    (node.object.object.name === "window" ||
      node.object.object.name === "globalThis" ||
      node.object.object.name === "self")
  ) {
    return true;
  }
  return false;
}

const noRawLocalStorage = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid direct `localStorage.*` (and `window.localStorage.*`) access in apps/web. Use safeReadLS / useLocalStorageState / createModuleStorage instead.",
    },
    schema: [],
    messages: { raw: RAW_LOCAL_STORAGE_MESSAGE },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isLocalStorageMember(node)) {
          context.report({ node, messageId: "raw" });
        }
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// `valid-tailwind-opacity` — flag color/opacity modifiers that won't render
// ─────────────────────────────────────────────────────────────────────────
//
// Tailwind v3 only generates a `<color>/<N>` utility when `N` exists in
// `theme.opacity`. The default scale steps in 5-pt increments
// (0, 5, 10, 15, 20… 100); the Sergeant preset extends that with `8`
// (canonical "barely there" 8 % wash on panel surfaces — see
// `packages/design-tokens/tailwind-preset.js`). Every other value
// (`bg-finyk/7`, `text-danger/12`, `border-line/18`) silently produces
// **no class** and the surrounding `dark:` / `hover:` override falls
// through to the light-mode background — exactly the dark-mode "светлые
// плитки" regression #814 fixed.
//
// This rule scans className strings (and template literals / JSX
// attributes) for the pattern `<utility>-<color>/<N>` and reports any
// `N` that is not in the allowed set. Arbitrary values (`bg-[#fff]/[.5]`)
// are left alone — Tailwind handles them via the JIT path.
//
// Keep `ALLOWED_TAILWIND_OPACITY_STEPS` in sync with the `opacity`
// extension in `packages/design-tokens/tailwind-preset.js`.

const ALLOWED_TAILWIND_OPACITY_STEPS = new Set([
  0, 5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
  95, 100,
]);

const TAILWIND_OPACITY_UTILITIES = [
  "bg",
  "text",
  "border",
  "ring",
  "fill",
  "stroke",
  "from",
  "to",
  "via",
  "shadow",
  "outline",
  "divide",
  "placeholder",
  "caret",
  "decoration",
  "accent",
];

// Match `<utility>-<color-token>/<digits>` where:
//   • `<utility>` is one of the color-aware utilities above,
//   • `<color-token>` is a non-arbitrary identifier (letters, digits,
//     hyphens) — the JIT path `bg-[#fff]/[.5]` is intentionally skipped,
//   • `<digits>` is 1–3 decimal digits.
// The leading `\b` lets variant prefixes (`dark:`, `hover:`, `lg:`) sit
// in front of the utility.
const RX_TAILWIND_OPACITY = new RegExp(
  String.raw`\b(` +
    TAILWIND_OPACITY_UTILITIES.join("|") +
    String.raw`)-([a-zA-Z][a-zA-Z0-9-]*)\/(\d{1,3})\b`,
  "g",
);

const TAILWIND_OPACITY_MESSAGE =
  "Tailwind opacity step `/{{step}}` is not registered — `{{utility}}` will silently render no class. Use one of: 0, 5, 8, 10, 15, 20, 25 … 100, or extend `theme.opacity` in `packages/design-tokens/tailwind-preset.js`.";

function findInvalidOpacitySteps(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  // Skip strings that obviously aren't className soup — cheap escape so
  // we don't tokenize unrelated literals (URLs, regexes, etc.).
  if (!value.includes("/")) return [];
  const hits = [];
  let match;
  RX_TAILWIND_OPACITY.lastIndex = 0;
  while ((match = RX_TAILWIND_OPACITY.exec(value)) !== null) {
    const [full, utilityPrefix, , stepRaw] = match;
    const step = Number(stepRaw);
    if (!Number.isFinite(step)) continue;
    if (ALLOWED_TAILWIND_OPACITY_STEPS.has(step)) continue;
    hits.push({ utility: full, prefix: utilityPrefix, step });
  }
  return hits;
}

const validTailwindOpacity = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Tailwind `<color>/<N>` opacity modifiers whose step is not registered in `theme.opacity` — the class is silently dropped, breaking dark-mode and hover overrides.",
    },
    schema: [],
    messages: { unregistered: TAILWIND_OPACITY_MESSAGE },
  },
  create(context) {
    function report(node, value) {
      const hits = findInvalidOpacitySteps(value);
      for (const hit of hits) {
        context.report({
          node,
          messageId: "unregistered",
          data: { utility: hit.utility, step: String(hit.step) },
        });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") report(node, node.value);
      },
      TemplateElement(node) {
        const cooked = node.value && node.value.cooked;
        if (typeof cooked === "string") report(node, cooked);
      },
    };
  },
};

// ─── no-low-contrast-text-on-fill ──────────────────────────────────────
//
// Forbid the saturated brand-fill + `text-white` combination on light
// surfaces. The full rationale, decision matrix, and contrast measurements
// live in `docs/BRANDBOOK.md` → "WCAG-AA `-strong` Tier" and
// `docs/brand-palette-wcag-aa-proposal.md`.
//
// Quick recap: every saturated brand colour ships with a `-strong`
// companion that clears WCAG AA 4.5 : 1 against `text-white`. Reaching
// for the saturated `bg-{family}` (or its `-{50…600}` scale steps) when
// the foreground is `text-white` regresses to ~2.4–2.8 : 1, which is
// what tripped /design's axe gate before PRs #854 / #855.
//
// What this rule flags (in a single className string):
//   - `bg-{family}` or `bg-{family}-{50|100|200|300|400|500|600}`,
//     un-prefixed by any variant (`dark:` / `hover:` / `lg:` etc.),
//   - co-located with `text-white` (also un-prefixed).
//
// What this rule deliberately does NOT flag:
//   - `bg-{family}-strong text-white` — the correct pairing.
//   - `bg-{family}-{700|800|900}` — explicit dark steps.
//   - `bg-{family}/<N>` — opacity-tinted soft washes (different concern;
//     the soft-tier text token is `text-{family}-strong`, not white).
//   - `bg-[#hex] text-white` — arbitrary values; opt-out for one-offs.
//   - `dark:bg-{family} text-white` — on dark surfaces emerald-500
//     vs. white passes (~5.4 : 1); the strong tier would actually
//     regress contrast there.
//   - `bg-{family} text-text` / no `text-white` — colour tile without
//     white-on-fill text is a different design problem.

const STRONG_BG_FAMILIES = [
  "brand",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
  "finyk",
  "fizruk",
  "routine",
  "nutrition",
];

// Match `bg-{family}` or `bg-{family}-{step}` with **no** variant prefix
// (variant prefixes contain a `:`; we exclude them via the leading
// boundary). The (?<!\S) lookbehind ensures we only match at a
// whitespace boundary so `dark:bg-finyk` does NOT match `bg-finyk`.
//
// The trailing lookahead deliberately rejects `/` so that
// `bg-brand/50` (an opacity-tinted soft wash, explicitly out-of-scope
// per the rule docs) does NOT half-match `bg-brand` with
// `stepRaw=undefined`. Only whitespace / end-of-string close the
// match; the optional `-(\d{1,3})` group already swallows the
// numeric step, so `bg-brand-500/40` similarly fails the lookahead
// and is left for the (separate) opacity-tier rules.
const RX_SATURATED_BG = new RegExp(
  String.raw`(?<!\S)bg-(${STRONG_BG_FAMILIES.join("|")})(?:-(\d{1,3}))?(?=\s|$)`,
  "g",
);

// `text-white` similarly must be base-state; variant-prefixed
// `dark:text-white` shouldn't fire the rule.
const RX_TEXT_WHITE = /(?<!\S)text-white(?=\s|$)/;

const LOW_CONTRAST_MESSAGE =
  "`{{utility}}` + `text-white` fails WCAG AA (~2.4–2.8 : 1). Use `bg-{{family}}-strong` instead — see docs/BRANDBOOK.md → 'WCAG-AA `-strong` Tier'.";

function findLowContrastFills(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  if (!RX_TEXT_WHITE.test(value)) return [];
  const hits = [];
  let match;
  RX_SATURATED_BG.lastIndex = 0;
  while ((match = RX_SATURATED_BG.exec(value)) !== null) {
    const [full, family, stepRaw] = match;
    if (stepRaw !== undefined) {
      const step = Number(stepRaw);
      // Steps 700/800/900 are dark enough to clear AA against white;
      // we only flag the lighter scale steps. (Nutrition's lime-700
      // technically clears 4.5 : 1 by a 0.17 margin only — the
      // `-strong` companion bumps it to lime-800; treat lime-700 as
      // acceptable here so we don't false-flag explicit dark-step
      // overrides like `bg-nutrition-700`.)
      if (!Number.isFinite(step) || step >= 700) continue;
    }
    hits.push({ utility: full, family });
  }
  return hits;
}

const noLowContrastTextOnFill = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid saturated brand `bg-*` utilities behind `text-white` — use the `-strong` companion (= 700/800 step) so the pairing clears WCAG AA 4.5 : 1.",
    },
    schema: [],
    messages: { lowContrast: LOW_CONTRAST_MESSAGE },
  },
  create(context) {
    function report(node, value) {
      const hits = findLowContrastFills(value);
      for (const hit of hits) {
        context.report({
          node,
          messageId: "lowContrast",
          data: { utility: hit.utility, family: hit.family },
        });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") report(node, node.value);
      },
      TemplateElement(node) {
        const cooked = node.value && node.value.cooked;
        if (typeof cooked === "string") report(node, cooked);
      },
    };
  },
};

const plugin = {
  rules: {
    "no-eyebrow-drift": noEyebrowDrift,
    "no-ellipsis-dots": noEllipsisDots,
    "no-raw-tracked-storage": noRawTrackedStorage,
    "no-raw-local-storage": noRawLocalStorage,
    "ai-marker-syntax": aiMarkerSyntax,
    "valid-tailwind-opacity": validTailwindOpacity,
    "no-low-contrast-text-on-fill": noLowContrastTextOnFill,
  },
};

export {
  TRACKED_STORAGE_KEY_NAMES,
  TRACKED_STORAGE_KEY_VALUES,
  RAW_TRACKED_STORAGE_MESSAGE,
  RAW_LOCAL_STORAGE_MESSAGE,
  ALLOWED_TAILWIND_OPACITY_STEPS,
  TAILWIND_OPACITY_UTILITIES,
  STRONG_BG_FAMILIES,
};

export default plugin;
