/**
 * sergeant-design — local ESLint plugin for Sergeant design-system guardrails.
 *
 * Rules:
 *   - no-eyebrow-drift: forbid the combination of `uppercase`, `tracking-*`,
 *     and `text-*` in a single className string. Use <SectionHeading> (or
 *     <Label normalCase={false}>) instead. Add
 *       // eslint-disable-next-line sergeant-design/no-eyebrow-drift
 *     for intentional stylistic exceptions (e.g. narrative overlay stories).
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

const plugin = {
  rules: {
    "no-eyebrow-drift": noEyebrowDrift,
  },
};

export default plugin;
