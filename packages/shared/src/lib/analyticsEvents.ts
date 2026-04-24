/**
 * Canonical analytics event names shared across platforms.
 *
 * Web owns the transport (`trackEvent`) today; mobile can forward these
 * names to whatever sink it adopts later without drifting on strings.
 */
export const ANALYTICS_EVENTS = Object.freeze({
  // Onboarding wizard (multi-step v2)
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_VIBE_PICKED: "onboarding_vibe_picked",
  ONBOARDING_STEP_VIEWED: "onboarding_step_viewed",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_GOAL_SET: "onboarding_goal_set",
  ONBOARDING_SKIPPED: "onboarding_skipped",

  // Finyk / activation
  EXPENSE_ADDED: "expense_added",
  EXPENSE_DELETED: "expense_deleted",
  BUDGET_SET: "budget_set",
  ANALYTICS_OPENED: "analytics_opened",
  BANK_CONNECT_STARTED: "bank_connect_started",
  BANK_CONNECT_SUCCESS: "bank_connect_success",
  PAYWALL_VIEWED: "paywall_viewed",
  FIRST_EXPENSE_ADDED: "first_expense_added",
  FIRST_INSIGHT_SEEN: "first_insight_seen",

  // FTUX: first action → preset → first real entry
  ONBOARDING_FIRST_ACTION_SHOWN: "onboarding_first_action_shown",
  ONBOARDING_FIRST_ACTION_PICKED: "onboarding_first_action_picked",
  FTUX_PRESET_SHEET_SHOWN: "ftux_preset_sheet_shown",
  FTUX_PRESET_PICKED: "ftux_preset_picked",
  FTUX_PRESET_CUSTOM: "ftux_preset_custom",
  FIRST_REAL_ENTRY: "first_real_entry",
  FTUX_TIME_TO_VALUE: "ftux_time_to_value",

  // Soft auth prompt (post-value)
  AUTH_PROMPT_SHOWN: "auth_prompt_shown",
  AUTH_PROMPT_DISMISSED: "auth_prompt_dismissed",
  AUTH_AFTER_VALUE: "auth_after_value",

  // Module checklists (Phase 2 — activation)
  MODULE_CHECKLIST_SHOWN: "module_checklist_shown",
  MODULE_CHECKLIST_STEP_DONE: "module_checklist_step_done",
  MODULE_CHECKLIST_DISMISSED: "module_checklist_dismissed",

  // Permissions (Phase 2 — contextual prompts)
  PERMISSION_REQUESTED: "permission_requested",
  PERMISSION_GRANTED: "permission_granted",
  PERMISSION_DENIED: "permission_denied",

  // Celebrations (Phase 2 — enriched feedback)
  CELEBRATION_SHOWN: "celebration_shown",

  // Hints / tips system
  HINT_SHOWN: "hint_shown",
  HINT_CLICKED: "hint_clicked",
  HINT_DISMISSED: "hint_dismissed",
  HINT_COMPLETED: "hint_completed",
} as const);

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
