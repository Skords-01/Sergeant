// Quick action chips registry — back-compat shim over the unified
// AssistantCapability catalogue in `@sergeant/shared`.
//
// `QuickAction` and `QuickActionModule` types are kept for the existing
// `ChatQuickActions` component (and its tests) so this PR is a pure
// data-source switch with no behavioural change. The shim will be deleted
// once `ChatQuickActions` is migrated to read `AssistantCapability`
// directly (next PR).

import {
  ASSISTANT_CAPABILITIES,
  getQuickActionCapabilities,
  type AssistantCapability,
  type CapabilityModule,
} from "@sergeant/shared";

/** Module set used by the chip UI (subset of CapabilityModule). */
export type QuickActionModule =
  | "hub"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition";

/**
 * Cross-cutting registry modules collapse onto the legacy `hub` bucket
 * for the chip UI (which only colour-codes 5 module variants). Module-
 * specific buckets pass through unchanged.
 */
function toLegacyModule(m: CapabilityModule): QuickActionModule {
  switch (m) {
    case "finyk":
    case "fizruk":
    case "routine":
    case "nutrition":
      return m;
    default:
      // cross / analytics / utility / memory all render as "hub" chips.
      return "hub";
  }
}

export interface QuickAction {
  id: string;
  module: QuickActionModule;
  label: string;
  shortLabel: string;
  icon: string;
  prompt: string;
  description?: string;
  priority: number;
  requiresOnline: boolean;
  keywords?: readonly string[];
}

/**
 * Mapping from registry id → legacy chip id where they diverge. Registry
 * ids match server tool names (e.g. `create_transaction`); legacy chip
 * ids predate the registry and are exposed in `data-testid` selectors and
 * mobile e2e specs that we don't want to churn.
 */
const LEGACY_CHIP_ID_OVERRIDES: Readonly<Record<string, string>> = {
  create_transaction: "add-expense",
};

/** Adapt a registry capability to the legacy `QuickAction` shape. */
function toQuickAction(c: AssistantCapability): QuickAction {
  return {
    // Registry ids are snake_case (matching server tool names); legacy chip
    // ids were kebab-case. Convert here to keep `data-testid` and any other
    // consumers stable.
    id: LEGACY_CHIP_ID_OVERRIDES[c.id] ?? c.id.replace(/_/g, "-"),
    module: toLegacyModule(c.module),
    label: c.label,
    // Legacy chips always had a shortLabel; fall back to label when the
    // catalogue entry doesn't define one (e.g. desktop-only cards).
    shortLabel: c.shortLabel ?? c.label,
    icon: c.icon,
    prompt: c.prompt,
    description: c.description,
    priority: c.quickActionPriority ?? 999,
    requiresOnline: c.requiresOnline ?? true,
    keywords: c.keywords,
  };
}

/** Single source of truth for the chip strip — derived from the catalogue. */
export const QUICK_ACTIONS: readonly QuickAction[] =
  getQuickActionCapabilities().map(toQuickAction);

/**
 * Full catalogue exposed under the legacy adapter, kept for any callers
 * that previously enumerated all chips for command-palette-style menus.
 * Not used by `ChatQuickActions` (it consumes `QUICK_ACTIONS`).
 */
export const ALL_QUICK_ACTIONS: readonly QuickAction[] =
  ASSISTANT_CAPABILITIES.map(toQuickAction);

/**
 * `prompt` ending in `": "` ⇒ incomplete: caller should prefill the input
 * instead of sending. Spec §1.
 */
export function isIncompletePrompt(prompt: string): boolean {
  return /:\s$/.test(prompt);
}

/**
 * Sort: active module first, then cross-cutting `hub`, then everything
 * else. Within a group by `priority` ascending; stable.
 */
export function sortQuickActionsForModule(
  actions: readonly QuickAction[],
  activeModule: QuickActionModule | null,
): QuickAction[] {
  const groupRank = (m: QuickActionModule): number => {
    if (activeModule && m === activeModule) return 0;
    if (m === "hub") return 1;
    return 2;
  };
  return actions
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => {
      const dg = groupRank(x.a.module) - groupRank(y.a.module);
      if (dg !== 0) return dg;
      const dp = x.a.priority - y.a.priority;
      if (dp !== 0) return dp;
      return x.idx - y.idx;
    })
    .map(({ a }) => a);
}

/** Top N chips after sorting; the rest go under the "Ще" toggle. */
export function pickTopQuickActions(
  actions: readonly QuickAction[],
  activeModule: QuickActionModule | null,
  limit = 6,
): QuickAction[] {
  return sortQuickActionsForModule(actions, activeModule).slice(0, limit);
}
