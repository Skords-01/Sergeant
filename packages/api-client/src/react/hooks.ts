import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import type { CoachInsightPayload } from "../endpoints/coach";
import type { ChatRequestPayload, ChatResponse } from "../endpoints/chat";
import type { BarcodeLookupResponse } from "../endpoints/barcode";
import type { FoodSearchResponse } from "../endpoints/foodSearch";
import type { MonoClientInfo, MonoStatementEntry } from "../endpoints/mono";
import type {
  PrivatBalanceFinalResponse,
  PrivatCredentials,
} from "../endpoints/privat";
import type {
  ModulePushPayload,
  PullAllResult,
  PushAllResult,
} from "../endpoints/sync";
import type {
  WeeklyDigestPayload,
  WeeklyDigestResponse,
} from "../endpoints/weeklyDigest";

import { useApiClient } from "./context";
import { apiQueryKeys } from "./queryKeys";

type QueryOpts<TData> = Omit<
  UseQueryOptions<TData, Error, TData>,
  "queryKey" | "queryFn"
>;
type MutationOpts<TData, TVars> = UseMutationOptions<TData, Error, TVars>;

// ── Coach ────────────────────────────────────────────────────────────────

export function useCoachMemory(opts?: QueryOpts<{ memory?: unknown }>) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.coach.memory(),
    queryFn: () => api.coach.getMemory(),
    ...opts,
  });
}

export function useCoachInsightMutation(
  opts?: MutationOpts<{ insight?: string | null }, CoachInsightPayload>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: (payload: CoachInsightPayload) =>
      api.coach.postInsight(payload),
    ...opts,
  });
}

// ── Chat ─────────────────────────────────────────────────────────────────

export function useChatMutation(
  opts?: MutationOpts<ChatResponse, ChatRequestPayload>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: (payload: ChatRequestPayload) => api.chat.send(payload),
    ...opts,
  });
}

// ── Push ─────────────────────────────────────────────────────────────────

export function useVapidPublicKey(opts?: QueryOpts<{ publicKey: string }>) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.push.vapidPublic(),
    queryFn: () => api.push.getVapidPublic(),
    ...opts,
  });
}

export function useSubscribePushMutation(
  opts?: MutationOpts<unknown, PushSubscriptionJSON>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: (sub: PushSubscriptionJSON) => api.push.subscribe(sub),
    ...opts,
  });
}

export function useUnsubscribePushMutation(
  opts?: MutationOpts<unknown, string>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: (endpoint: string) => api.push.unsubscribe(endpoint),
    ...opts,
  });
}

// ── Food search / Barcode ────────────────────────────────────────────────

export function useFoodSearch(
  query: string,
  opts?: QueryOpts<FoodSearchResponse>,
) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.foodSearch.query(query),
    queryFn: ({ signal }) => api.foodSearch.search(query, { signal }),
    enabled: !!query && query.length >= 2,
    ...opts,
  });
}

export function useBarcodeLookup(
  barcode: string,
  opts?: QueryOpts<BarcodeLookupResponse>,
) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.barcode.lookup(barcode),
    queryFn: () => api.barcode.lookup(barcode),
    enabled: !!barcode,
    ...opts,
  });
}

// ── Mono / Privat ────────────────────────────────────────────────────────

export function useMonoClientInfo(
  token: string,
  opts?: QueryOpts<MonoClientInfo>,
) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.mono.clientInfo(token),
    queryFn: ({ signal }) => api.mono.clientInfo(token, { signal }),
    enabled: !!token,
    ...opts,
  });
}

export interface MonoStatementArgs {
  token: string;
  accountId: string;
  from: number;
  to: number;
}

export function useMonoStatement(
  { token, accountId, from, to }: MonoStatementArgs,
  opts?: QueryOpts<MonoStatementEntry[]>,
) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.mono.statement(token, accountId, from, to),
    queryFn: ({ signal }) =>
      api.mono.statement(token, accountId, from, to, { signal }),
    enabled: !!token && !!accountId,
    ...opts,
  });
}

export function usePrivatBalanceFinal(
  creds: PrivatCredentials | null,
  opts?: QueryOpts<PrivatBalanceFinalResponse>,
) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiQueryKeys.privat.balanceFinal(creds?.merchantId ?? ""),
    queryFn: ({ signal }) => api.privat.balanceFinal(creds!, { signal }),
    enabled: !!creds?.merchantId && !!creds?.merchantToken,
    ...opts,
  });
}

// ── Sync ─────────────────────────────────────────────────────────────────

export function useSyncPushAllMutation(
  opts?: MutationOpts<PushAllResult, Record<string, ModulePushPayload>>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: (modules) => api.sync.pushAll(modules),
    ...opts,
  });
}

export function useSyncPullAllMutation(
  opts?: MutationOpts<PullAllResult, void>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: () => api.sync.pullAll(),
    ...opts,
  });
}

// ── Weekly Digest ────────────────────────────────────────────────────────

export function useWeeklyDigestMutation(
  opts?: MutationOpts<WeeklyDigestResponse, WeeklyDigestPayload>,
) {
  const api = useApiClient();
  return useMutation({
    mutationFn: (payload) => api.weeklyDigest.generate(payload),
    ...opts,
  });
}
