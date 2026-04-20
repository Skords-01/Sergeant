/**
 * Finyk — module root shell for the mobile app.
 *
 * Mobile port of the web `apps/web/src/modules/finyk/FinykApp.tsx`.
 * At this point in the migration (Phase 4, PR1) the shell only covers
 * the **Overview** landing surface: a greeting, a placeholder hero
 * card, and a nav grid that pushes the other four screens via the
 * nested expo-router Stack layout.
 *
 * Subsequent Phase 4 PRs will progressively replace the placeholder
 * hero / quick-action slots with ported components from the web shell:
 *
 * 1. PR2 — lift remaining pure storage + domain modules into
 *    `@sergeant/finyk-domain` so the mobile shell has a DOM-free
 *    data source.
 * 2. PR3 — port `TxRow` / `TxListItem` / `ManualExpenseSheet` /
 *    `DebtCard` / `SubCard` and wire them into Transactions / Assets.
 * 3. PR4 — port Overview's `HeroCard` / `MonthPulseCard` /
 *    `PlanFactCard` / `QuickAddCard` plus `useUnifiedFinanceData`.
 * 4. PR5+ — charts (Q7 = `victory-native`) and Detox E2E.
 *
 * Keeping the module shell as its own component (instead of inlining
 * into `app/(tabs)/finyk/index.tsx`) gives the future ports a stable
 * composition boundary and mirrors the web file layout where tests
 * can mount `<FinykApp />` directly.
 */
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";

import { FinykNavGrid } from "./components/FinykNavGrid";

export function FinykApp() {
  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-cream-50"
      testID="finyk-app-root"
    >
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-16"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-stone-900">ФІНІК</Text>
        <Text className="text-sm text-stone-500 mt-1 mb-5">
          Особисті фінанси та бюджети
        </Text>

        <Card variant="finyk-soft" padding="lg" className="mb-5">
          <Text className="text-sm font-semibold text-brand-700 mb-1">
            Привіт! 👋
          </Text>
          <Text className="text-xs text-brand-700/80 leading-5">
            Це перший зріз модуля Фінік на мобілці. Навігація між сторінками вже
            працює — наступні PR-и додадуть дашборд з балансом, транзакції,
            бюджети та графіки.
          </Text>
        </Card>

        {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift -- Mobile has no <SectionHeading> primitive yet; this is the first Finyk PR, will migrate when the shared component lands. */}
        <Text className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Швидкий перехід
        </Text>
        <FinykNavGrid />

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

export default FinykApp;
