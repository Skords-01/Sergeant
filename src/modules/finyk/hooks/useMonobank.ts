import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { monoApi, isApiError } from "@shared/api";
import { finykKeys, hashToken } from "@shared/lib/queryKeys";
import { TX_CACHE_TTL, CURRENCY } from "../constants";
import {
  readJSON,
  writeJSON,
  readRaw,
  writeRaw,
  removeItem,
} from "../lib/finykStorage.js";
import { normalizeTransaction } from "../domain/transactions";
import { trackEvent, ANALYTICS_EVENTS } from "../../../core/analytics";

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
 * }} Transaction
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
 * Current synchronisation state for the Monobank data fetch.
 */

const HUB_FINYK_CACHE_EVENT = "hub-finyk-cache-updated";

function notifyHubFinykCache() {
  try {
    window.dispatchEvent(new CustomEvent(HUB_FINYK_CACHE_EVENT));
  } catch {}
}

const CACHE_KEY = "finyk_tx_cache";
const INFO_CACHE_KEY = "finyk_info_cache";
const TOKEN_KEY = "finyk_token";
const REMEMBER_KEY = "finyk_token_remembered";

function reportSilentError(scope, error) {
  console.warn(`[finyk] ${scope}`, error);
}

// Migration from "finto_*" keys to "finyk_*" is handled by storageManager (finyk_001_rename_finto_keys).

function loadCache() {
  const cache = readJSON(CACHE_KEY, null);
  if (!cache || typeof cache !== "object") return null;
  if (!cache.timestamp || Date.now() - cache.timestamp > TX_CACHE_TTL)
    return null;
  if (!Array.isArray(cache.txs) || cache.txs.length === 0) return null;
  return cache;
}

function loadAnyCache() {
  const cache = readJSON(CACHE_KEY, null);
  if (!cache || typeof cache !== "object") return null;
  if (!Array.isArray(cache.txs) || cache.txs.length === 0) return null;
  return cache;
}

function saveCache(txs) {
  if (writeJSON(CACHE_KEY, { txs, timestamp: Date.now() })) {
    notifyHubFinykCache();
  }
}

/** Останній повний знімок — якщо поточний кеш зіпсований (мало транзакцій), відновлюємо звідси */
const LAST_GOOD_KEY = "finyk_tx_cache_last_good";

function saveLastGoodBackup(txs) {
  if (!txs || txs.length < 3) return;
  writeJSON(LAST_GOOD_KEY, { txs, timestamp: Date.now() });
}

function loadLastGoodBackup() {
  const c = readJSON(LAST_GOOD_KEY, null);
  if (!c || typeof c !== "object") return null;
  if (!Array.isArray(c.txs) || c.txs.length === 0) return null;
  return c;
}

function dedupeByIdSort(txs: Array<{ id: string; time: number }>) {
  const map = new Map(txs.map((t) => [t.id, t]));
  return Array.from(map.values()).sort((a, b) => b.time - a.time);
}

/**
 * Зливає нові транзакції з попередніми: для рахунків, де запит впав, лишаємо старі дані.
 * Транзакції без _accountId лишаємо лише якщо є хоча б один невдалий рахунок (можливо вони з нього).
 */
function mergeTxWithPrevious(
  prevTxs: Array<{ id: string; time: number; _accountId?: string | null }>,
  fetchedByAccount: Record<
    string,
    Array<{ id: string; time: number; _accountId?: string | null }>
  >,
  succeededAccountIds: string[],
  allTargetAccountIds: string[],
) {
  const succ = new Set(succeededAccountIds);
  const flatNew = Object.values(fetchedByAccount).flat();
  const newById = new Map(flatNew.map((t) => [t.id, t]));

  const hasFailure = allTargetAccountIds.some((id) => !succ.has(id));

  if (!hasFailure && flatNew.length > 0) {
    return dedupeByIdSort(flatNew);
  }

  if (!hasFailure && flatNew.length === 0 && prevTxs.length > 0) {
    return prevTxs;
  }

  if (!hasFailure && flatNew.length === 0) {
    return [];
  }

  const keepFromPrev = prevTxs.filter((t) => {
    if (newById.has(t.id)) return false;
    const aid = t._accountId;
    if (aid == null) return hasFailure;
    return !succ.has(aid);
  });

  return dedupeByIdSort([...keepFromPrev, ...flatNew]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

const STATEMENT_STALE_TIME = 60_000;
const STATEMENT_GC_TIME = 5 * 60_000;
const CLIENT_INFO_STALE_TIME = 10 * 60_000;
const CLIENT_INFO_GC_TIME = 60 * 60_000;

/**
 * Per-account statement fetch через React Query-кеш. Раніше тут був
 * ручний retry/backoff (fetchStatementWithRetry); тепер RQ сам ретраїть
 * і зберігає результат під `finykKeys.monoStatement(accId, from, to)`,
 * щоб відокремлені спостерігачі (`useMonoStatements`) мали той самий
 * кеш-rail. `queryClient.fetchQuery` чекає на ретраї перш ніж повернути
 * дані, тож зовнішній контракт `fetchAllTx`/`fetchMonth` не міняється:
 * повертаємо масив або кидаємо `AuthError` на 401/403.
 */
async function fetchStatementViaRQ(queryClient, tok, accId, from, to) {
  if (!navigator.onLine) {
    throw new Error("Немає підключення до інтернету. Спробуй пізніше.");
  }
  try {
    const data = await queryClient.fetchQuery({
      queryKey: finykKeys.monoStatement(accId, from, to),
      queryFn: ({ signal }) =>
        monoApi.statement(tok, accId, from, to, { signal }),
      staleTime: STATEMENT_STALE_TIME,
      gcTime: STATEMENT_GC_TIME,
      retry: (n, e) => {
        if (n >= 2) return false;
        if (isApiError(e) && e.kind === "http" && e.isAuth) return false;
        return true;
      },
      retryDelay: (attempt) => 1000 * (attempt + 1),
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (isApiError(e) && e.kind === "http") {
      if (e.isAuth) {
        throw new AuthError(e.serverMessage || `HTTP ${e.status}`);
      }
      throw new Error(e.serverMessage || `HTTP ${e.status}`);
    }
    if (e instanceof AuthError) throw e;
    throw e;
  }
}

/**
 * Client-info fetch через RQ-кеш. `useMonoClientInfo(token)` читає той
 * самий ключ і одразу віддає свіжі дані без додаткового запиту.
 */
async function fetchClientInfoViaRQ(queryClient, tok) {
  try {
    return await queryClient.fetchQuery({
      queryKey: finykKeys.monoClientInfo(hashToken(tok)),
      queryFn: ({ signal }) => monoApi.clientInfo(tok, { signal }),
      staleTime: CLIENT_INFO_STALE_TIME,
      gcTime: CLIENT_INFO_GC_TIME,
      retry: (n, e) => {
        if (n >= 1) return false;
        if (isApiError(e) && e.kind === "http" && e.isAuth) return false;
        return true;
      },
      retryDelay: (attempt) => 1000 * (attempt + 1),
    });
  } catch (e) {
    if (isApiError(e) && e.kind === "http") {
      if (e.isAuth) {
        throw new AuthError(e.serverMessage || `HTTP ${e.status}`);
      }
      throw new Error(e.serverMessage || `HTTP ${e.status}`);
    }
    if (e instanceof AuthError) throw e;
    throw e;
  }
}

/**
 * Hook for fetching and caching Monobank transactions.
 * Handles token storage, multi-account sync with retry, cache fallback,
 * and automatic refresh on visibility change / online event.
 *
 * @returns {{
 *   token: string,
 *   clientInfo: object|null,
 *   accounts: object[],
 *   transactions: Transaction[],
 *   realTx: Transaction[],
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
 *   historyTx: Transaction[],
 *   loadingHistory: boolean,
 *   clearTxCache: () => void,
 *   disconnect: () => void,
 * }}
 */
export function useMonobank() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => {
    const rememberedToken = readRaw(REMEMBER_KEY, "");
    if (rememberedToken) return rememberedToken;

    let sessionToken = "";
    try {
      sessionToken = sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      sessionToken = "";
    }
    if (sessionToken) return sessionToken;

    const legacyToken = readRaw(TOKEN_KEY, "");
    if (legacyToken) {
      try {
        sessionStorage.setItem(TOKEN_KEY, legacyToken);
      } catch {}
      removeItem(TOKEN_KEY);
      return legacyToken;
    }
    return "";
  });
  const [clientInfo, setClientInfo] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [historyTx, setHistoryTx] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncState, setSyncState] = useState({
    status: "idle",
    source: "none",
    lastSuccess: null,
    lastError: "",
    accountsTotal: 0,
    accountsOk: 0,
  });

  const lastAutoRefreshAtRef = useRef(0);
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;
  const [authError, setAuthError] = useState("");

  const fetchAllTx = async (tok, allAccounts) => {
    const targetAccounts = allAccounts.filter(
      (a) => a.currencyCode === CURRENCY.UAH,
    );
    if (targetAccounts.length === 0) {
      setTransactions([]);
      setSyncState({
        status: "success",
        source: "network",
        lastSuccess: new Date(),
        lastError: "",
        accountsTotal: 0,
        accountsOk: 0,
      });
      return;
    }

    setLoadingTx(true);
    setSyncState({
      status: "loading",
      source: "none",
      lastSuccess: syncStateRef.current.lastSuccess,
      lastError: "",
      accountsTotal: targetAccounts.length,
      accountsOk: 0,
    });
    try {
      const prevSnapshot = loadAnyCache();
      const prevTxs = prevSnapshot?.txs || [];
      const errors = [];
      const now = new Date();
      const from = Math.floor(
        new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
      );
      const to = Math.floor(Date.now() / 1000);
      let accountsOk = 0;
      const fetchedByAccount = {};
      const succeededIds = [];

      // Monobank часто ріже запити — послідовно + retry; при падінні рахунку лишаємо старі транзакції з нього.
      for (let i = 0; i < targetAccounts.length; i++) {
        const acc = targetAccounts[i];
        try {
          const txs = await fetchStatementViaRQ(
            queryClient,
            tok,
            acc.id,
            from,
            to,
          );
          const tagged = txs.map((t) =>
            normalizeTransaction(t, { source: "monobank", accountId: acc.id }),
          );
          fetchedByAccount[acc.id] = tagged;
          succeededIds.push(acc.id);
          accountsOk += 1;
        } catch (e) {
          if (e instanceof AuthError) {
            setAuthError(
              e.message ||
                "Токен Monobank недійсний або закінчився. Оновіть токен.",
            );
            setError("");
            setSyncState({
              status: "error",
              source: syncStateRef.current.lastSuccess ? "cache" : "none",
              lastSuccess: syncStateRef.current.lastSuccess,
              lastError: e.message,
              accountsTotal: targetAccounts.length,
              accountsOk,
            });
            setLoadingTx(false);
            return;
          }
          errors.push(
            `${acc.id}: ${e?.message || "Помилка отримання транзакцій"}`,
          );
        }
        if (i < targetAccounts.length - 1) {
          await sleep(1200);
        }
      }

      const allIds = targetAccounts.map((a) => a.id);
      let unique = mergeTxWithPrevious(
        prevTxs,
        fetchedByAccount,
        succeededIds,
        allIds,
      );

      // Якщо API повернув майже нічого, а в кеші було більше — не втрачаємо дані
      if (
        unique.length < Math.min(prevTxs.length, 8) &&
        prevTxs.length > unique.length + 3
      ) {
        const backup = loadLastGoodBackup();
        if (backup && backup.txs.length > unique.length) {
          unique = mergeTxWithPrevious(
            backup.txs,
            fetchedByAccount,
            succeededIds,
            allIds,
          );
        }
      }

      if (unique.length === 0 && prevTxs.length > 0) {
        unique = prevTxs;
      }

      if (unique.length > 0) {
        setTransactions(unique);
        saveCache(unique);
        if (accountsOk === targetAccounts.length || unique.length >= 15) {
          saveLastGoodBackup(unique);
        }
        const nowTs = new Date();
        setLastUpdated(nowTs);
        setError(
          errors.length > 0
            ? "Частина рахунків не оновилась — показано злиті дані (старі + нові)."
            : "",
        );
        setSyncState({
          status: errors.length > 0 ? "partial" : "success",
          source: "network",
          lastSuccess: nowTs,
          lastError: errors.join("; "),
          accountsTotal: targetAccounts.length,
          accountsOk,
        });
      } else {
        const fallback = loadAnyCache() || loadLastGoodBackup();
        if (fallback) {
          setTransactions(fallback.txs);
          setLastUpdated(new Date(fallback.timestamp));
          setSyncState({
            status: "partial",
            source: "cache",
            lastSuccess: new Date(fallback.timestamp),
            lastError: errors.join("; "),
            accountsTotal: targetAccounts.length,
            accountsOk,
          });
        } else {
          setTransactions([]);
          setSyncState({
            status: "error",
            source: "none",
            lastSuccess: null,
            lastError: errors.join("; "),
            accountsTotal: targetAccounts.length,
            accountsOk,
          });
        }
        if (errors.length > 0) {
          setError(
            "Mono API тимчасово обмежив запити. Повторіть через 1-2 хв.",
          );
        }
      }
    } catch (e) {
      setError(e?.message || "Помилка завантаження транзакцій");
      setSyncState({
        status: "error",
        source: "none",
        lastSuccess: syncStateRef.current.lastSuccess,
        lastError: e?.message || "Помилка завантаження транзакцій",
        accountsTotal: targetAccounts.length,
        accountsOk: 0,
      });
    } finally {
      setLoadingTx(false);
    }
  };

  const connect = async (tok, forceRefresh = false, remember = false) => {
    setConnecting(true);
    setError("");

    const cleanToken = tok.trim();
    if (!cleanToken) {
      setError("Введіть токен");
      setConnecting(false);
      return;
    }

    // Fire before the network call so we measure attempts, not just
    // successes. Payload stays minimal — no token, no personal data.
    trackEvent(ANALYTICS_EVENTS.BANK_CONNECT_STARTED, {
      bank: "monobank",
      forceRefresh: Boolean(forceRefresh),
    });

    try {
      let info;
      const parsedInfoCache = readJSON(INFO_CACHE_KEY, null);
      if (!forceRefresh && parsedInfoCache) {
        if (parsedInfoCache?.token && parsedInfoCache.token !== cleanToken) {
          throw new Error("Кеш профілю належить іншому токену");
        }
        info = parsedInfoCache?.info || parsedInfoCache;
      } else {
        if (forceRefresh) {
          queryClient.removeQueries({
            queryKey: finykKeys.monoClientInfo(hashToken(cleanToken)),
          });
        }
        info = await fetchClientInfoViaRQ(queryClient, cleanToken);
        if (!writeJSON(INFO_CACHE_KEY, { token: cleanToken, info })) {
          reportSilentError("save client-info cache", "write failed");
        }
      }

      setClientInfo(info);
      setAccounts(info.accounts || []);
      try {
        sessionStorage.setItem(TOKEN_KEY, cleanToken);
      } catch (e) {
        reportSilentError("save session token", e);
      }
      removeItem(TOKEN_KEY);
      if (remember) {
        writeRaw(REMEMBER_KEY, cleanToken);
      } else {
        removeItem(REMEMBER_KEY);
      }
      setToken(cleanToken);

      trackEvent(ANALYTICS_EVENTS.BANK_CONNECT_SUCCESS, {
        bank: "monobank",
        accountsTotal: Array.isArray(info.accounts) ? info.accounts.length : 0,
      });

      const cache = forceRefresh ? null : loadCache();
      if (cache) {
        setTransactions(cache.txs);
        setLastUpdated(new Date(cache.timestamp));
        setSyncState({
          status: "success",
          source: "cache",
          lastSuccess: new Date(cache.timestamp),
          lastError: "",
          accountsTotal: (info.accounts || []).filter(
            (a) => a.currencyCode === CURRENCY.UAH,
          ).length,
          accountsOk: (info.accounts || []).filter(
            (a) => a.currencyCode === CURRENCY.UAH,
          ).length,
        });
      } else {
        await fetchAllTx(cleanToken, info.accounts || []);
      }
    } catch (e) {
      if (e instanceof AuthError) {
        setAuthError(
          e.message ||
            "Токен Monobank недійсний або закінчився. Оновіть токен.",
        );
      } else {
        setError(e?.message || "Помилка авторизації");
      }
    } finally {
      setConnecting(false);
    }
  };

  const fetchMonth = async (year, month) => {
    const cacheKey = `finyk_tx_cache_${year}_${month}`;
    const legacyKey = `finto_tx_cache_${year}_${month}`;

    let cached = readJSON(cacheKey, null);
    if (!cached) {
      const legacy = readJSON(legacyKey, null);
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
      const results = [];
      for (let i = 0; i < targetAccounts.length; i++) {
        const acc = targetAccounts[i];
        try {
          const txs = await fetchStatementViaRQ(
            queryClient,
            token,
            acc.id,
            from,
            to,
          );
          results.push(
            txs.map((t) =>
              normalizeTransaction(t, {
                source: "monobank",
                accountId: acc.id,
              }),
            ),
          );
        } catch {}
        if (i < targetAccounts.length - 1) await sleep(800);
      }
      const unique = Array.from(
        new Map(results.flat().map((t) => [t.id, t])).values(),
      ).sort((a, b) => b.time - a.time);
      setHistoryTx(unique);
      if (unique.length > 0) {
        writeJSON(cacheKey, { txs: unique, timestamp: Date.now() });
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const refresh = async () => {
    // Примусовий refresh на UI-рівні — прибиваємо RQ-кеш для Monobank,
    // щоб наступні fetchQuery-виклики в fetchAllTx не віддавали дані
    // у межах `staleTime` без мережевого звернення.
    queryClient.invalidateQueries({ queryKey: finykKeys.mono });
    try {
      const info = await fetchClientInfoViaRQ(queryClient, token);
      setAuthError("");
      setClientInfo(info);
      setAccounts(info.accounts || []);
      if (!writeJSON(INFO_CACHE_KEY, { token, info })) {
        reportSilentError("refresh info cache", "write failed");
      }
      await fetchAllTx(token, info.accounts || []);
      return;
    } catch (e) {
      if (e instanceof AuthError || (isApiError(e) && e.isAuth)) {
        setAuthError(
          e?.message ||
            "Токен Monobank недійсний або закінчився. Оновіть токен у налаштуваннях.",
        );
        return;
      }
      reportSilentError("refresh client-info", e);
    }
    await fetchAllTx(token, accounts);
  };

  const connectRef = useRef(null);
  connectRef.current = connect;
  useEffect(() => {
    if (token) {
      const isRemembered = readRaw(REMEMBER_KEY, "") === token;
      connectRef.current(token, false, isRemembered);
    }
  }, [token]);

  const refreshRef = useRef(null);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!token || !clientInfo) return;

    const HOUR = 60 * 60 * 1000;

    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) return;
      if (connecting || loadingTx) return;

      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < HOUR) return;
      lastAutoRefreshAtRef.current = now;
      refreshRef.current();
    };

    const id = setInterval(maybeRefresh, HOUR);
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("online", maybeRefresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("online", maybeRefresh);
    };
  }, [token, clientInfo, connecting, loadingTx]);

  const disconnect = () => {
    setToken("");
    setClientInfo(null);
    setAccounts([]);
    setTransactions([]);
    setSyncState({
      status: "idle",
      source: "none",
      lastSuccess: null,
      lastError: "",
      accountsTotal: 0,
      accountsOk: 0,
    });
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
    // Прибиваємо RQ-кеш, щоб після logout всі спостерігачі нових RQ-хуків
    // (`useMonoClientInfo`, `useMonoStatements`) не видавали кешовані
    // дані попереднього користувача.
    queryClient.removeQueries({ queryKey: finykKeys.mono });
    notifyHubFinykCache();
  };

  const clearTxCache = () => {
    removeItem(CACHE_KEY);
    removeItem(LAST_GOOD_KEY);
    // Очищуємо тільки statement-кеш RQ; client-info залишаємо,
    // токен не змінювався — профіль валідний.
    queryClient.removeQueries({ queryKey: finykKeys.monoStatements });
    notifyHubFinykCache();
    setTransactions([]);
    setLastUpdated(null);
    setSyncState((s) => ({
      ...s,
      status: "idle",
      source: "none",
      lastError: "",
      accountsTotal: s.accountsTotal || 0,
      accountsOk: 0,
    }));
    setError("");
  };

  return {
    token,
    clientInfo,
    accounts,
    transactions,
    realTx: transactions,
    connecting,
    loadingTx,
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
