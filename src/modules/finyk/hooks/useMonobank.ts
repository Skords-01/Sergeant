import { useState, useEffect, useMemo, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { monoApi, isApiError, type MonoClientInfo } from "@shared/api";
import { finykKeys, hubKeys, hashToken } from "@shared/lib/queryKeys";
import { authAwareRetry } from "@shared/lib/queryClient";
import { CURRENCY } from "../constants";
import {
  readJSON,
  writeJSON,
  readRaw,
  writeRaw,
  removeItem,
} from "../lib/finykStorage.js";
import { normalizeTransaction, type Transaction } from "../domain/transactions";
import { trackEvent, ANALYTICS_EVENTS } from "../../../core/analytics";
import { useMonoStatements } from "./useMonoStatements";

/**
 * @typedef {{
 *   id: string,
 *   time: number,
 *   amount: number,
 *   description: string,
 *   mcc?: number,
 *   _accountId?: string|null,
 *   _manual?: boolean,
 *   _manualId?: string,
 * }} MonoTransaction
 * A Monobank transaction (or manual expense) with metadata.
 */

/**
 * @typedef {{
 *   status: 'idle'|'loading'|'success'|'partial'|'error',
 *   source: 'none'|'network'|'cache',
 *   lastSuccess: Date|null,
 *   lastError: string,
 *   accountsTotal: number,
 *   accountsOk: number,
 * }} SyncState
 */

const CACHE_KEY = "finyk_tx_cache";
const LAST_GOOD_KEY = "finyk_tx_cache_last_good";
const INFO_CACHE_KEY = "finyk_info_cache";
const TOKEN_KEY = "finyk_token";
const REMEMBER_KEY = "finyk_token_remembered";

const CLIENT_INFO_STALE_TIME = 10 * 60_000;
const CLIENT_INFO_GC_TIME = 60 * 60_000;
const STATEMENT_STALE_TIME = 60_000;

function reportSilentError(scope: string, error: unknown) {
  console.warn(`[finyk] ${scope}`, error);
}

function readStoredToken(): string {
  const remembered = readRaw(REMEMBER_KEY, "");
  if (remembered) return remembered;
  let sessionToken = "";
  try {
    sessionToken = sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    sessionToken = "";
  }
  if (sessionToken) return sessionToken;
  const legacy = readRaw(TOKEN_KEY, "");
  if (legacy) {
    try {
      sessionStorage.setItem(TOKEN_KEY, legacy);
    } catch {
      /* ignore */
    }
    removeItem(TOKEN_KEY);
    return legacy;
  }
  return "";
}

interface Snapshot {
  txs: Transaction[];
  timestamp: number;
}

function loadCacheSnapshot(): Snapshot | null {
  const c = readJSON<Snapshot | null>(CACHE_KEY, null);
  if (!c || !Array.isArray(c.txs) || c.txs.length === 0) return null;
  return c;
}

function loadLastGoodBackup(): Snapshot | null {
  const c = readJSON<Snapshot | null>(LAST_GOOD_KEY, null);
  if (!c || !Array.isArray(c.txs) || c.txs.length === 0) return null;
  return c;
}

function notifyHubFinykPreview(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: hubKeys.preview("finyk") });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook для зчитування Monobank-транзакцій поточного місяця через React Query.
 *
 * **Архітектура:** `useQuery(monoClientInfo)` → `useMonoStatements(accounts)`
 * → derived `syncState` / `transactions` / `loadingTx`. Більше немає власної
 * sync-стейт-машини (`fetchAllTx`, `mergeTxWithPrevious`, `loadLastGoodBackup`
 * fallback як активного кода-шляху): RQ-кеш сам тримає per-account дані,
 * а `useQueries.combine` злиттям відновлює дані успішних рахунків навіть
 * коли інші впали (та сама семантика, що колишній merge-with-previous).
 *
 * **Cross-device / offline-first:** `localStorage` `finyk_tx_cache` —
 * тільки read-only snapshot для холодного старту (до першої успішної
 * відповіді RQ) та UI-fallback, коли поточний місяць пустий. При кожному
 * непустому результаті ми оновлюємо snapshot і сигналимо Hub preview
 * через `invalidateQueries(hubKeys.preview("finyk"))`.
 *
 * **fetchMonth(year, month)** — історичні місяці тримаються окремо,
 * бо мають інший ключ (`finykKeys.monoStatement(accId, from, to)` з
 * іншим діапазоном) і інше UI-місце (сторінка `Transactions`, виписка
 * минулих місяців). Фетч там послідовний з паузами — аби не натрапити
 * на rate-limit Monobank.
 *
 * @returns {{
 *   token: string,
 *   clientInfo: MonoClientInfo|null,
 *   accounts: object[],
 *   transactions: MonoTransaction[],
 *   realTx: MonoTransaction[],
 *   connecting: boolean,
 *   loadingTx: boolean,
 *   error: string,
 *   lastUpdated: Date|null,
 *   syncState: SyncState,
 *   authError: string,
 *   setAuthError: (msg: string) => void,
 *   connect: (token: string, forceRefresh?: boolean, remember?: boolean) => Promise<void>,
 *   refresh: () => Promise<void>,
 *   fetchMonth: (year: number, month: number) => Promise<void>,
 *   historyTx: MonoTransaction[],
 *   loadingHistory: boolean,
 *   clearTxCache: () => void,
 *   disconnect: () => void,
 * }}
 */
export function useMonobank() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>(readStoredToken);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

  // === Client info ===
  //
  // `useQuery` керує запитом профілю Monobank. Перед першим запитом
  // гідратуємо RQ-кеш з `localStorage` (INFO_CACHE_KEY), щоб UI не блимав
  // "підключення…" при поверненні на сторінку.
  useEffect(() => {
    if (!token) return;
    const key = finykKeys.monoClientInfo(hashToken(token));
    if (queryClient.getQueryData(key)) return;
    const cached = readJSON<{ token?: string; info?: MonoClientInfo } | null>(
      INFO_CACHE_KEY,
      null,
    );
    if (cached && cached.token === token && cached.info) {
      queryClient.setQueryData(key, cached.info);
    }
  }, [token, queryClient]);

  const clientInfoQuery = useQuery<MonoClientInfo>({
    queryKey: finykKeys.monoClientInfo(hashToken(token)),
    queryFn: ({ signal }) => monoApi.clientInfo(token, { signal }),
    enabled: Boolean(token),
    staleTime: CLIENT_INFO_STALE_TIME,
    gcTime: CLIENT_INFO_GC_TIME,
    refetchOnWindowFocus: false,
    retry: authAwareRetry(1),
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });

  // Після кожного успішного фетчу профілю зберігаємо його у localStorage.
  useEffect(() => {
    if (!token || !clientInfoQuery.data) return;
    if (!writeJSON(INFO_CACHE_KEY, { token, info: clientInfoQuery.data })) {
      reportSilentError("save client-info cache", "write failed");
    }
  }, [token, clientInfoQuery.data]);

  // Auth-помилки з client-info пробрасуємо у `authError`, решту — у `error`.
  useEffect(() => {
    const e = clientInfoQuery.error;
    if (!e) return;
    if (isApiError(e) && e.kind === "http" && e.isAuth) {
      setAuthError(
        e.serverMessage ||
          "Токен Monobank недійсний або закінчився. Оновіть токен.",
      );
    } else {
      setError(
        (e as Error)?.message || "Не вдалось завантажити профіль Monobank",
      );
    }
  }, [clientInfoQuery.error]);

  const clientInfo: MonoClientInfo | null = clientInfoQuery.data ?? null;
  const accounts = useMemo(
    () => clientInfo?.accounts ?? [],
    [clientInfo?.accounts],
  );

  // === Statements ===
  const statements = useMonoStatements(token, accounts);

  // Проброс auth-помилки, якщо хоч один `/statement/...` повернув 401/403.
  useEffect(() => {
    const e = statements.error;
    if (!e) return;
    if (isApiError(e) && e.kind === "http" && e.isAuth) {
      setAuthError(
        e.serverMessage ||
          "Токен Monobank недійсний або закінчився. Оновіть токен.",
      );
    }
  }, [statements.error]);

  // === Snapshot fallback ===
  //
  // Для UI важлива стабільність: поки RQ перевантажує дані (`isLoading`),
  // або якщо поточний місяць поверне порожньо, показуємо останній
  // непустий snapshot з localStorage.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(
    () => loadCacheSnapshot() ?? loadLastGoodBackup(),
  );

  useEffect(() => {
    if (statements.transactions.length === 0) return;
    const payload: Snapshot = {
      txs: statements.transactions,
      timestamp: Date.now(),
    };
    if (writeJSON(CACHE_KEY, payload)) {
      notifyHubFinykPreview(queryClient);
    }
    setSnapshot(payload);
    // "Last good" — тільки коли усі рахунки успішні або транзакцій ≥ 15
    // (той самий поріг, що й раніше; захист від порожніх відповідей, які
    // іноді віддає Monobank при rate-limit відновленні).
    if (!statements.hasPartialFailure || statements.transactions.length >= 15) {
      if (statements.transactions.length >= 3) {
        writeJSON(LAST_GOOD_KEY, payload);
      }
    }
  }, [statements.transactions, statements.hasPartialFailure, queryClient]);

  const transactions: Transaction[] =
    statements.transactions.length > 0
      ? statements.transactions
      : (snapshot?.txs ?? []);

  // `lastUpdated` — час останньої успішної відповіді RQ серед усіх
  // per-account запитів. Поки ще нема успіху або нульовий фетч — беремо
  // timestamp snapshot-а з localStorage. Пам'ятаємо: snapshot сам
  // оновлюється через `useEffect` вище, тож UI бачить одне і те саме.
  const lastUpdated: Date | null = useMemo(() => {
    if (statements.transactions.length > 0) {
      const updates = queryClient
        .getQueriesData({ queryKey: finykKeys.monoStatements })
        .map(([key]) => queryClient.getQueryState(key)?.dataUpdatedAt ?? 0);
      const max = updates.length > 0 ? Math.max(...updates) : 0;
      if (max > 0) return new Date(max);
    }
    return snapshot ? new Date(snapshot.timestamp) : null;
  }, [statements.transactions, snapshot, queryClient]);

  // === Derived sync state ===
  const syncState = useMemo(() => {
    let status: "idle" | "loading" | "success" | "partial" | "error" = "idle";
    if (!token || accounts.length === 0) {
      status = token ? "loading" : "idle";
    } else if (statements.isLoading) {
      status = "loading";
    } else if (statements.accountsTotal === 0) {
      // Підключений клієнт без жодного UAH-рахунку.
      status = "success";
    } else if (
      statements.hasPartialFailure &&
      statements.accountsOk === 0 &&
      snapshot
    ) {
      status = "partial";
    } else if (statements.hasPartialFailure) {
      status = "partial";
    } else if (statements.error) {
      status = "error";
    } else {
      status = "success";
    }

    const source: "none" | "network" | "cache" =
      statements.transactions.length > 0
        ? "network"
        : snapshot
          ? "cache"
          : "none";

    const lastError = statements.error
      ? (statements.error as Error)?.message || String(statements.error)
      : "";

    return {
      status,
      source,
      lastSuccess: lastUpdated,
      lastError,
      accountsTotal: statements.accountsTotal,
      accountsOk: statements.accountsOk,
    };
  }, [
    token,
    accounts.length,
    statements.isLoading,
    statements.accountsTotal,
    statements.accountsOk,
    statements.hasPartialFailure,
    statements.error,
    statements.transactions.length,
    snapshot,
    lastUpdated,
  ]);

  // === Connect / disconnect / refresh ===
  const connect = async (
    tok: string,
    forceRefresh: boolean = false,
    remember: boolean = false,
  ) => {
    const clean = (tok ?? "").trim();
    if (!clean) {
      setError("Введіть токен");
      return;
    }
    setConnecting(true);
    setError("");
    setAuthError("");

    trackEvent(ANALYTICS_EVENTS.BANK_CONNECT_STARTED, {
      bank: "monobank",
      forceRefresh: Boolean(forceRefresh),
    });

    try {
      const key = finykKeys.monoClientInfo(hashToken(clean));
      if (forceRefresh) {
        queryClient.removeQueries({ queryKey: key });
      }
      const info = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: ({ signal }) => monoApi.clientInfo(clean, { signal }),
        staleTime: CLIENT_INFO_STALE_TIME,
        retry: authAwareRetry(1),
        retryDelay: (attempt) => 1000 * (attempt + 1),
      });

      try {
        sessionStorage.setItem(TOKEN_KEY, clean);
      } catch (e) {
        reportSilentError("save session token", e);
      }
      removeItem(TOKEN_KEY); // legacy fallback
      if (remember) {
        writeRaw(REMEMBER_KEY, clean);
      } else {
        removeItem(REMEMBER_KEY);
      }
      if (!writeJSON(INFO_CACHE_KEY, { token: clean, info })) {
        reportSilentError("save client-info cache", "write failed");
      }
      setToken(clean);

      trackEvent(ANALYTICS_EVENTS.BANK_CONNECT_SUCCESS, {
        bank: "monobank",
        accountsTotal: Array.isArray(info.accounts) ? info.accounts.length : 0,
      });
    } catch (e) {
      if (isApiError(e) && e.kind === "http" && e.isAuth) {
        setAuthError(
          e.serverMessage ||
            "Токен Monobank недійсний або закінчився. Оновіть токен.",
        );
      } else {
        const msg =
          e instanceof Error && e.message ? e.message : "Помилка авторизації";
        setError(msg);
      }
    } finally {
      setConnecting(false);
    }
  };

  const refresh = async () => {
    setError("");
    await queryClient.invalidateQueries({ queryKey: finykKeys.mono });
  };

  const disconnect = () => {
    setToken("");
    setError("");
    setAuthError("");
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      reportSilentError("disconnect cleanup", e);
    }
    removeItem(TOKEN_KEY); // legacy fallback
    removeItem(REMEMBER_KEY);
    removeItem("finto_token");
    removeItem(CACHE_KEY);
    removeItem(LAST_GOOD_KEY);
    removeItem(INFO_CACHE_KEY);
    setSnapshot(null);
    queryClient.removeQueries({ queryKey: finykKeys.mono });
    notifyHubFinykPreview(queryClient);
  };

  const clearTxCache = () => {
    removeItem(CACHE_KEY);
    removeItem(LAST_GOOD_KEY);
    // Client-info залишаємо — токен не змінювався, профіль валідний.
    queryClient.removeQueries({ queryKey: finykKeys.monoStatements });
    setSnapshot(null);
    notifyHubFinykPreview(queryClient);
    setError("");
  };

  // === Historical months (separate reactive stream) ===
  const [historyTx, setHistoryTx] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const fetchMonth = async (year: number, month: number) => {
    const cacheKey = `finyk_tx_cache_${year}_${month}`;
    const legacyKey = `finto_tx_cache_${year}_${month}`;

    let cached = readJSON<Snapshot | null>(cacheKey, null);
    if (!cached) {
      const legacy = readJSON<Snapshot | null>(legacyKey, null);
      if (legacy) {
        writeJSON(cacheKey, legacy);
        removeItem(legacyKey);
        cached = legacy;
      }
    }
    if (cached && Array.isArray(cached.txs) && cached.txs.length > 0) {
      setHistoryTx(cached.txs);
      return;
    }

    setLoadingHistory(true);
    try {
      const targetAccounts = accounts.filter(
        (a) => a.currencyCode === CURRENCY.UAH,
      );
      const from = Math.floor(new Date(year, month, 1).getTime() / 1000);
      const to = Math.floor(
        new Date(year, month + 1, 0, 23, 59, 59).getTime() / 1000,
      );
      const results: Transaction[][] = [];
      // Послідовно з паузами, щоб не натрапити на rate-limit Monobank.
      for (let i = 0; i < targetAccounts.length; i++) {
        const acc = targetAccounts[i];
        try {
          const txs = await queryClient.fetchQuery({
            queryKey: finykKeys.monoStatement(acc.id, from, to),
            queryFn: ({ signal }) =>
              monoApi.statement(token, acc.id, from, to, { signal }),
            staleTime: STATEMENT_STALE_TIME,
            retry: authAwareRetry(2),
            retryDelay: (attempt) => 1000 * (attempt + 1),
          });
          results.push(
            (txs || []).map((t) =>
              normalizeTransaction(t, {
                source: "monobank",
                accountId: acc.id,
              }),
            ),
          );
        } catch {
          // Частковий збій — продовжуємо решту рахунків.
        }
        if (i < targetAccounts.length - 1) await sleep(800);
      }
      const unique = Array.from(
        new Map(results.flat().map((t) => [t.id, t])).values(),
      ).sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
      setHistoryTx(unique);
      if (unique.length > 0) {
        writeJSON(cacheKey, { txs: unique, timestamp: Date.now() });
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  // Automatic token auto-connect on mount: коли `token` відновлений з
  // session/REMEMBER, `clientInfoQuery` вже сам стартує запит. Тут ми
  // лише надсилаємо аналітику, щоб зберегти поведінку трекінгу старого
  // коду.
  const trackedRef = useRef<string>("");
  useEffect(() => {
    if (!token || trackedRef.current === token) return;
    trackedRef.current = token;
    trackEvent(ANALYTICS_EVENTS.BANK_CONNECT_STARTED, {
      bank: "monobank",
      forceRefresh: false,
    });
  }, [token]);

  return {
    token,
    clientInfo,
    accounts,
    transactions,
    realTx: transactions,
    connecting,
    loadingTx: statements.isLoading,
    error,
    lastUpdated,
    syncState,
    authError,
    setAuthError,
    connect,
    refresh,
    fetchMonth,
    historyTx,
    loadingHistory,
    clearTxCache,
    disconnect,
  };
}
