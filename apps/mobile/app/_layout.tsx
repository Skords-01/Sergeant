import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiClientProvider } from "@sergeant/api-client/react";

import { apiClient } from "@/api/apiClient";
import { PushRegistrar } from "@/features/push/PushRegistrar";
import { QueryProvider } from "@/providers/QueryProvider";
import { CloudSyncProvider } from "@/sync";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <ApiClientProvider client={apiClient}>
            <CloudSyncProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="(auth)"
                  options={{ presentation: "modal" }}
                />
                <Stack.Screen name="+not-found" />
              </Stack>
              <PushRegistrar />
            </CloudSyncProvider>
          </ApiClientProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
