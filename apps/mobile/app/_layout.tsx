import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ApiClientProvider } from "@sergeant/api-client/react";

import { apiClient } from "@/api/apiClient";
import { SyncStatusIndicator } from "@/core/SyncStatusIndicator";
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
import { QueryProvider } from "@/providers/QueryProvider";
import { CloudSyncProvider, useCloudSyncContext } from "@/sync";

/**
 * Floating sync-status pill. Lives at the root of every screen so the
 * user sees offline / syncing / error state regardless of which tab
 * they're on. Reads `syncError` + `pullAll` from the surrounding
 * `CloudSyncProvider` context — re-invoking `useCloudSync` here would
 * double-attach the scheduler, NetInfo listeners and periodic retry
 * timer. `pointerEvents="box-none"` keeps the safe-area wrapper from
 * intercepting touches outside the pill itself.
 */
function SyncStatusOverlay() {
  const sync = useCloudSyncContext();
  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      <SyncStatusIndicator
        variant="silent-when-idle"
        error={sync?.syncError ?? null}
        onRetry={sync ? () => void sync.pullAll() : undefined}
      />
    </SafeAreaView>
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
              <StatusBar style="light" />
              <View style={{ flex: 1 }}>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="(auth)"
                    options={{ presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="settings"
                    options={{ presentation: "modal" }}
                  />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <SyncStatusOverlay />
              </View>
              <PushRegistrar />
            </CloudSyncProvider>
          </ApiClientProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
