/**
 * Finyk — shared page stub.
 *
 * Temporary scaffolding for the four non-Overview screens (Transactions,
 * Budgets, Analytics, Assets) until their real content is ported in
 * subsequent Phase 4 PRs. Kept intentionally generic so each page file
 * stays a one-line composition and Jest smoke-tests can assert screens
 * render without crashing.
 *
 * Mirrors the feel of `@/components/ModuleStub` but lives inside the
 * Finyk module so future work can swap it out page-by-page without
 * touching the global hub stub.
 */
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";

export interface FinykPageStubProps {
  title: string;
  description: string;
  plannedFeatures: readonly string[];
  /** Optional extra content slotted above the planned-features card. */
  children?: ReactNode;
}

export function FinykPageStub({
  title,
  description,
  plannedFeatures,
  children,
}: FinykPageStubProps) {
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-cream-50">
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-16"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-fg">{title}</Text>
        <Text className="text-sm text-fg-muted mt-1 mb-5">{description}</Text>

        {children}

        <Card variant="default" padding="lg">
          <Text className="text-sm font-semibold text-fg mb-3">
            Заплановано до порту
          </Text>
          {plannedFeatures.map((item) => (
            <View key={item} className="flex-row items-start mb-2">
              <Text className="text-brand-600 mr-2">•</Text>
              <Text className="text-sm text-fg flex-1 leading-5">{item}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
