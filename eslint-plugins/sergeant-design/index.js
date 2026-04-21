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

const plugin = {
  rules: {
    "no-eyebrow-drift": noEyebrowDrift,
    "no-ellipsis-dots": noEllipsisDots,
    "no-raw-tracked-storage": noRawTrackedStorage,
  },
};

export {
  TRACKED_STORAGE_KEY_NAMES,
  TRACKED_STORAGE_KEY_VALUES,
  RAW_TRACKED_STORAGE_MESSAGE,
};

export default plugin;
