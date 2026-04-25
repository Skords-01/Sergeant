import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { monoWebhookApi } from "@shared/api";
import { finykKeys, hubKeys } from "@shared/lib/queryKeys";
import {
  safeReadStringLS,
  safeWriteLS,
  safeRemoveLS,
} from "@shared/lib/storage";
import { useFlag } from "../../../core/lib/featureFlags";
import { trackEvent, ANALYTICS_EVENTS } from "../../../core/analytics";
import { useToast } from "@shared/hooks/useToast";

const TOKEN_KEY = "finyk_token";
const REMEMBER_KEY = "finyk_token_remembered";
const MIGRATION_DONE_KEY = "finyk_mono_token_migrated";

function readLegacyToken(): string {
  const remembered = safeReadStringLS(REMEMBER_KEY);
  if (remembered) return remembered;

  // sessionStorage not covered by safeReadLS — use try/catch
  let sessionToken = "";
  try {
    sessionToken = sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    sessionToken = "";
  }
  if (sessionToken) return sessionToken;

  return safeReadStringLS(TOKEN_KEY) ?? "";
}

function removeLegacyTokenKeys(): void {
  safeRemoveLS(TOKEN_KEY);
  safeRemoveLS(REMEMBER_KEY);
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage may be disabled */
  }
}

/**
 * One-time migration: if the user has a legacy Monobank token stored in
 * localStorage/sessionStorage and the webhook feature flag is on, POST
 * the token to `/api/mono/connect`, then remove the browser-stored keys.
 *
 * Runs once per session (guarded by ref + localStorage flag).
 */
export function useMonoTokenMigration(isLoggedIn: boolean): void {
  const webhookEnabled = useFlag("mono_webhook");
  const queryClient = useQueryClient();
  const toast = useToast();
  const migratedRef = useRef(false);

  useEffect(() => {
    if (!webhookEnabled || !isLoggedIn || migratedRef.current) return;

    // Already migrated in a previous session
    if (safeReadStringLS(MIGRATION_DONE_KEY) === "1") return;

    const legacyToken = readLegacyToken();
    if (!legacyToken) return;

    migratedRef.current = true;

    (async () => {
      try {
        await monoWebhookApi.connect(legacyToken.trim());
        removeLegacyTokenKeys();
        safeWriteLS(MIGRATION_DONE_KEY, "1");

        await queryClient.invalidateQueries({
          queryKey: finykKeys.monoSyncState,
        });
        queryClient.invalidateQueries({
          queryKey: hubKeys.preview("finyk"),
        });

        trackEvent(ANALYTICS_EVENTS.MONO_TOKEN_MIGRATED, {
          source: "auto",
        });

        toast.success("Monobank мігровано на webhook-режим");
      } catch {
        // Migration failed — keep legacy token, user can retry manually
        migratedRef.current = false;
      }
    })();
  }, [webhookEnabled, isLoggedIn, queryClient, toast]);
}
