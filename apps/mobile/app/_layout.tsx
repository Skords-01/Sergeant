import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiClientProvider } from "@sergeant/api-client/react";

import { apiClient } from "@/api/apiClient";
import { SyncStatusOverlay } from "@/core/SyncStatusOverlay";
import { ColorSchemeBridge } from "@/core/theme/ColorSchemeBridge";
import { PushRegistrar } from "@/features/push/PushRegistrar";
// Registers the mobile `expo-haptics`-based adapter on the shared
// haptic contract (`@sergeant/shared`). Import for side effects only.
import "@/lib/haptic";
// Registers the mobile file-download stub on the shared contract.
// Replaced with an `expo-file-system` + `expo-sharing` adapter in Phase 4+.
import "@/lib/fileDownload";
// Registers the mobile `Keyboard.addListener`-based adapter on the shared
// visual-keyboard-inset contract (`@sergeant/shared`). Import for side
// effects only.
import "@/hooks/useVisualKeyboardInset";
import { initObservability } from "@/lib/observability";
import { useDeepLinks } from "@/lib/useDeepLinks";
import { QueryProvider } from "@/providers/QueryProvider";
import { CloudSyncProvider } from "@/sync";
import { ToastContainer, ToastProvider } from "@/components/ui/Toast";

/**
 * Inner shell — mounted below the providers so `useDeepLinks` runs
 * inside `<Stack>`'s navigation context. See `src/lib/useDeepLinks.ts`
 * for why the hook must not fire before Expo Router boots.
 */
function RootShell() {
  useDeepLinks();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
        <Stack.Screen name="assistant" options={{ presentation: "modal" }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <SyncStatusOverlay />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initObservability();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <ApiClientProvider client={apiClient}>
            <CloudSyncProvider>
              <ToastProvider>
                <ColorSchemeBridge />
                <StatusBar style="light" />
                <RootShell />
                <ToastContainer />
                <PushRegistrar />
              </ToastProvider>
            </CloudSyncProvider>
          </ApiClientProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
