/**
 * Centralized localStorage key constants.
 * Prevents magic strings scattered across the codebase.
 */
export const STORAGE_KEYS = {
  // Hub
  DARK_MODE: "hub_dark_mode_v1",
  LAST_MODULE: "hub_last_module",
  ROUTINE: "hub_routine_v1",

  // Finyk
  FINYK_TX_CACHE: "finyk_tx_cache",
  FINYK_INFO_CACHE: "finyk_info_cache",
  FINYK_TOKEN: "finyk_token",
  FINYK_STORAGE: "finyk_storage_v2",
  FINYK_SHOW_BALANCE: "finyk_show_balance_v1",

  // Fizruk
  FIZRUK_WORKOUTS: "fizruk_workouts_v1",
  FIZRUK_EXERCISES: "fizruk_exercises_v1",
  FIZRUK_TEMPLATES: "fizruk_templates_v1",
  FIZRUK_PLAN: "fizruk-storage-monthly-plan",
  FIZRUK_WELLBEING: "fizruk_wellbeing_v1",
  FIZRUK_MEASUREMENTS: "fizruk_measurements_v1",
  FIZRUK_SELECTED_TEMPLATE: "fizruk_selected_template_id_v1",
};
