import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import sergeantDesign from "./eslint-plugins/sergeant-design/index.js";

const tsRecommendedScoped = tseslint.configs.recommended.map((cfg) => ({
  ...cfg,
  files: ["**/*.{ts,tsx}"],
}));

export default [
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "**/node_modules/**",
      "node_modules/**",
      ".agents/**",
      "artifacts/**",
      "mcps/**",
      "playwright-report/**",
      "**/playwright-report/**",
      "test-results/**",
      "**/test-results/**",
      ".turbo/**",
      "**/.turbo/**",
    ],
  },
  js.configs.recommended,
  ...tsRecommendedScoped,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "react-hooks": reactHooks,
      "sergeant-design": sergeantDesign,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Design-system guardrail — the canonical eyebrow label must go
      // through <SectionHeading> (or <Label>) so tone/size changes stay
      // in one place. Add the file-scoped override below for the DS
      // primitives themselves.
      "sergeant-design/no-eyebrow-drift": "error",
      // Typography guardrail — user-facing strings must use the single
      // ellipsis glyph `…` (U+2026), not three ASCII dots `...`. The
      // typographic glyph kerns correctly and is what Web Interface
      // Guidelines recommend for truncation cues. Auto-fixable.
      "sergeant-design/no-ellipsis-dots": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/prop-types": "off",
      // Prevent reintroduction of the legacy `forest` palette retired when
      // Sergeant migrated to the Emerald/Teal/Coral/Lime palette. The old
      // `accent-*` tonal palette was also retired, but `accent` has since
      // been re-introduced as a semantic alias for the brand accent colour
      // (see tailwind.config.js colors.accent → rgb(var(--c-accent))). The
      // rule therefore forbids `*-forest*` and `*-accent-<number>` (tonal
      // variants) but allows the new semantic `*-accent` / `*-accent/<N>`.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|divide|placeholder|caret)-(?:forest(?:-grad)?|accent-\\d+)(?:\\/\\d+)?\\b/]",
          message:
            "Legacy `forest` / tonal `accent-NNN` retired — use semantic `accent`, `brand-500`, `fizruk`, `routine`, `nutrition`, or `finyk` instead.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|divide|placeholder|caret)-(?:forest(?:-grad)?|accent-\\d+)(?:\\/\\d+)?\\b/]",
          message:
            "Legacy `forest` / tonal `accent-NNN` retired — use semantic `accent`, `brand-500`, `fizruk`, `routine`, `nutrition`, or `finyk` instead.",
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // DS primitives that legitimately define the eyebrow treatment.
  // SectionHeading owns the uppercase+tracking+text size tokens, Label
  // owns the field-label eyebrow variant, and chartTheme defines the
  // tooltip label token — all three are the single source-of-truth
  // callers should import from.
  {
    files: [
      "apps/web/src/shared/components/ui/SectionHeading.tsx",
      "apps/web/src/shared/components/ui/FormField.tsx",
      "apps/web/src/shared/charts/chartTheme.ts",
    ],
    rules: {
      "sergeant-design/no-eyebrow-drift": "off",
    },
  },
  // The plugin that defines `no-ellipsis-dots` contains `...` in its
  // own error message + docs — it would be tautological to lint
  // itself.
  {
    files: ["eslint-plugins/sergeant-design/**/*.js"],
    rules: {
      "sergeant-design/no-ellipsis-dots": "off",
    },
  },
  // Jest setup / test files need jest globals.
  {
    files: [
      "**/jest.setup.js",
      "**/jest.setup.ts",
      "**/*.test.{js,jsx,ts,tsx}",
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
    ],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
  // Mobile cloud-sync guardrail — `useLocalStorage` must not be called
  // with a key tracked in `apps/mobile/src/sync/config.ts → SYNC_MODULES`,
  // because MMKV writes bypass JS and would silently break cloud sync.
  // The fix is to call `useSyncedStorage` from `@/sync/useSyncedStorage`
  // instead, which mirrors the write into the sync queue.
  {
    files: ["apps/mobile/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "apps/mobile/src/sync/useSyncedStorage.ts",
      "apps/mobile/**/__tests__/**",
      "apps/mobile/**/*.test.{js,jsx,ts,tsx}",
    ],
    rules: {
      "sergeant-design/no-raw-tracked-storage": "error",
    },
  },
  // Web localStorage guardrail — direct `localStorage.*` access is a
  // hazard (throws on quota / private-browsing / corrupt JSON). The
  // shared `safeReadLS` / `safeWriteLS` helpers in
  // `apps/web/src/shared/lib/storage.ts`, the `useLocalStorageState`
  // hook, and `createModuleStorage` wrap the API with try/catch and
  // quota fallbacks. New web code MUST go through one of those.
  //
  // The `ignores` list below names every existing call-site as of the
  // rule's introduction (see `docs/frontend-tech-debt.md` §2). Migrate
  // a file → drop it from the list. Test files are exempt entirely:
  // they routinely seed/inspect raw `localStorage` as fixtures and are
  // already isolated from production hazards.
  {
    files: ["apps/web/src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      // Tests can use `localStorage` freely as fixtures.
      "apps/web/src/**/*.test.{js,jsx,ts,tsx}",
      "apps/web/src/**/__tests__/**",
      // Storage primitives — these are the wrappers everyone else
      // should call into.
      "apps/web/src/shared/lib/storage.ts",
      "apps/web/src/shared/lib/storageManager.ts",
      "apps/web/src/shared/lib/storageQuota.ts",
      "apps/web/src/shared/lib/typedStore.ts",
      "apps/web/src/shared/lib/createModuleStorage.ts",
      "apps/web/src/shared/lib/weeklyDigestStorage.ts",
      "apps/web/src/shared/lib/perf.ts",
      "apps/web/src/shared/hooks/useLocalStorageState.ts",
      "apps/web/src/shared/hooks/useDarkMode.ts",
      "apps/web/src/shared/hooks/usePushNotifications.ts",
      "apps/web/src/shared/hooks/useActiveFizrukWorkout.ts",
      // Cloud-sync internals — the queue / patcher / state writer all
      // need direct access; users should call the cloud-sync API.
      "apps/web/src/core/cloudSync/logger.ts",
      "apps/web/src/core/cloudSync/queue/offlineQueue.ts",
      "apps/web/src/core/cloudSync/state/moduleData.ts",
      "apps/web/src/core/cloudSync/storagePatch.ts",
      // Module storage wrappers (legitimate primitives in their own
      // namespace).
      "apps/web/src/modules/finyk/hooks/useStorage.ts",
      "apps/web/src/modules/finyk/lib/storageManager.ts",
      "apps/web/src/modules/nutrition/domain/nutritionBackup.ts",
      // Files that haven't been migrated yet — TODO: convert each to
      // `safeReadLS` / `useLocalStorageState` / `createModuleStorage`
      // and remove the entry below.
      "apps/web/src/core/App.tsx",
      "apps/web/src/core/AssistantAdviceCard.tsx",
      "apps/web/src/core/HubChat.tsx",
      "apps/web/src/core/HubDashboard.tsx",
      "apps/web/src/core/HubReports.tsx",
      "apps/web/src/core/HubSearch.tsx",
      "apps/web/src/core/OnboardingWizard.tsx",
      "apps/web/src/core/ProfilePage.tsx",
      "apps/web/src/core/TodayFocusCard.tsx",
      "apps/web/src/core/analytics.ts",
      "apps/web/src/core/app/pwaAction.ts",
      "apps/web/src/core/app/useIosInstallBanner.ts",
      "apps/web/src/core/app/usePwaInstall.ts",
      "apps/web/src/core/hints/HintsOrchestrator.tsx",
      "apps/web/src/core/hooks/usePwaActions.ts",
      "apps/web/src/core/hub/useFinykHubPreview.ts",
      "apps/web/src/core/hubBackup.ts",
      "apps/web/src/core/hubSearchEngine.ts",
      "apps/web/src/core/lib/chatActions/crossActions.ts",
      "apps/web/src/core/lib/chatActions/finykActions.ts",
      "apps/web/src/core/lib/chatActions/fizrukActions.ts",
      "apps/web/src/core/lib/dailyFinykSummary.ts",
      "apps/web/src/core/lib/hubChatContext.ts",
      "apps/web/src/core/lib/hubChatUtils.ts",
      "apps/web/src/core/lib/insightsEngine.ts",
      "apps/web/src/core/lib/recommendationEngine.ts",
      "apps/web/src/core/lib/recommendations/financeContext.ts",
      "apps/web/src/core/onboarding/DailyNudge.tsx",
      "apps/web/src/core/onboarding/FirstActionSheet.tsx",
      "apps/web/src/core/onboarding/ModuleChecklist.tsx",
      "apps/web/src/core/onboarding/PermissionsPrompt.tsx",
      "apps/web/src/core/onboarding/ReEngagementCard.tsx",
      "apps/web/src/core/onboarding/cleanupDemoData.ts",
      "apps/web/src/core/onboarding/firstRealEntry.ts",
      "apps/web/src/core/onboarding/onboardingGate.ts",
      "apps/web/src/core/onboarding/presetApply.ts",
      "apps/web/src/core/onboarding/seedDemoData.ts",
      "apps/web/src/core/onboarding/vibePicks.ts",
      "apps/web/src/core/settings/FinykSection.tsx",
      "apps/web/src/core/settings/GeneralSection.tsx",
      "apps/web/src/core/settings/hubPrefs.ts",
      "apps/web/src/core/useCoachInsight.ts",
      "apps/web/src/core/useWeeklyDigest.ts",
      "apps/web/src/modules/finyk/pages/Overview.tsx",
      "apps/web/src/modules/finyk/pages/Transactions.tsx",
      "apps/web/src/modules/fizruk/components/TodayPlanCard.tsx",
      "apps/web/src/modules/fizruk/hooks/useExerciseCatalog.ts",
      "apps/web/src/modules/fizruk/hooks/useFizrukProgramStart.ts",
      "apps/web/src/modules/fizruk/hooks/useFizrukWorkoutReminder.ts",
      "apps/web/src/modules/fizruk/hooks/useMonthlyPlan.ts",
      "apps/web/src/modules/fizruk/hooks/useTrainingProgram.ts",
      "apps/web/src/modules/fizruk/hooks/useWorkouts.ts",
      "apps/web/src/modules/fizruk/pages/Body.tsx",
      "apps/web/src/modules/fizruk/pages/Dashboard.tsx",
      "apps/web/src/modules/fizruk/pages/Progress.tsx",
      "apps/web/src/modules/fizruk/pages/Workouts.tsx",
      "apps/web/src/modules/nutrition/hooks/useNutritionReminders.ts",
      "apps/web/src/modules/routine/components/RoutineCalendarPanel.tsx",
      "apps/web/src/modules/routine/hooks/useRoutineReminders.ts",
    ],
    rules: {
      "sergeant-design/no-raw-local-storage": "error",
    },
  },
  // AuthContext migration (Session 4B, PR after #390): "who am I" is
  // single-sourced via `useUser()` from `@sergeant/api-client/react` → GET
  // `/api/v1/me`. Better Auth stays only as the actions layer. Block
  // reintroduction of `useSession` from `better-auth/react` anywhere in the
  // web app except `authClient.ts`, which is the one legitimate adapter
  // module — it owns the Better Auth client and intentionally does NOT
  // re-export `useSession` (see the note in that file).
  {
    files: ["apps/web/src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["apps/web/src/core/authClient.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "better-auth/react",
              importNames: ["useSession"],
              message:
                "Use `useAuth()` from `core/AuthContext` (backed by `useUser()` from `@sergeant/api-client/react` → GET /api/v1/me). `useSession` from Better Auth is only for the actions layer inside `core/authClient.ts`.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
];
