import { useState, useEffect, useRef } from "react";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { normalizeTransaction } from "../domain/transactions";

const PRIVAT_ID_KEY = "finyk_privat_id";
const PRIVAT_TOKEN_KEY = "finyk_privat_token";
const PRIVAT_CACHE_KEY = "finyk_privat_tx_cache";
const PRIVAT_BALANCE_KEY = "finyk_privat_balance_cache";
const PRIVAT_CACHE_TTL = 30 * 60 * 1000;

function loadStoredCreds() {
  try {
    const id =
      localStorage.getItem(PRIVAT_ID_KEY) ||
      sessionStorage.getItem(PRIVAT_ID_KEY) ||
      "";
    const token =
      localStorage.getItem(PRIVAT_TOKEN_KEY) ||
      sessionStorage.getItem(PRIVAT_TOKEN_KEY) ||
      "";
    return { id, token };
  } catch {
    return { id: "", token: "" };
  }
}

function saveCreds(id, token, remember) {
  try {
    if (remember) {
      localStorage.setItem(PRIVAT_ID_KEY, id);
      localStorage.setItem(PRIVAT_TOKEN_KEY, token);
      sessionStorage.removeItem(PRIVAT_ID_KEY);
      sessionStorage.removeItem(PRIVAT_TOKEN_KEY);
    } else {
      sessionStorage.setItem(PRIVAT_ID_KEY, id);
      sessionStorage.setItem(PRIVAT_TOKEN_KEY, token);
      localStorage.removeItem(PRIVAT_ID_KEY);
      localStorage.removeItem(PRIVAT_TOKEN_KEY);
    }
  } catch {}
}

function clearCreds() {
  try {
    localStorage.removeItem(PRIVAT_ID_KEY);
    localStorage.removeItem(PRIVAT_TOKEN_KEY);
    sessionStorage.removeItem(PRIVAT_ID_KEY);
    sessionStorage.removeItem(PRIVAT_TOKEN_KEY);
  } catch {}
}

function loadTxCache() {
  try {
    const raw = localStorage.getItem(PRIVAT_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c.timestamp > PRIVAT_CACHE_TTL) return null;
    if (!c.txs || c.txs.length === 0) return null;
    return c;
  } catch {
    return null;
  }
}

function saveTxCache(txs) {
  try {
    localStorage.setItem(
      PRIVAT_CACHE_KEY,
      JSON.stringify({ txs, timestamp: Date.now() }),
    );
  } catch {}
}

function loadBalanceCache() {
  try {
    const raw = localStorage.getItem(PRIVAT_BALANCE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c.timestamp > PRIVAT_CACHE_TTL) return null;
    return c.accounts || null;
  } catch {
    return null;
  }
}

function saveBalanceCache(accounts) {
  try {
    localStorage.setItem(
      PRIVAT_BALANCE_KEY,
      JSON.stringify({ accounts, timestamp: Date.now() }),
    );
  } catch {}
}

function fmtDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (y && m && d) return `${d}-${m}-${y}`;
  return isoDate;
}

function toTimestamp(trandate, trantime) {
  try {
    const [d, m, y] = (trandate || "").split(".");
    const dateStr = `${y}-${m}-${d}T${trantime || "00:00:00"}`;
    const ts = new Date(dateStr).getTime();
    if (!isNaN(ts)) return Math.floor(ts / 1000);
  } catch {}
  return Math.floor(Date.now() / 1000);
}

function normalizePrivatTransaction(row, accountId) {
  const amountRaw = parseFloat(row.SUM) || 0;
  const amountKopecks = Math.round(amountRaw * 100);
  const ts = toTimestamp(row.TRANDATE, row.TRANTIME);
  const description =
    row.OSND || row.PRYZNACH || row.AUT_CNTR_NAM || "Транзакція";
  const sourceId =
    row.REF || row.REFN || row.DOC_NUMBER || `${ts}_${amountKopecks}`;

  return normalizeTransaction(
    {
      id: `privat_${sourceId}`,
      time: ts,
      amount: amountKopecks,
      description,
      mcc: 0,
      raw: row,
    },
    { source: "privatbank", accountId: accountId || row.AUT_MY_ACC || null },
  );
}

function normalizeAccount(raw) {
  return {
    id: raw.acc || raw.id || raw.AUT_MY_ACC || "",
    balance: Math.round((parseFloat(raw.balance) || 0) * 100),
    creditLimit: Math.round((parseFloat(raw.creditLimit) || 0) * 100),
    currency: raw.currency || "UAH",
    type: "privatbank",
    alias: raw.alias || raw.acc || "",
    _source: "privatbank",
  };
}

async function apiFetch(merchantId, merchantToken, path, queryParams = {}) {
  const params = new URLSearchParams({ path, ...queryParams });
  const res = await fetch(`${apiUrl("/api/privat")}?${params}`, {
    headers: {
      "X-Privat-Id": merchantId,
      "X-Privat-Token": merchantToken,
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const payload = await res.json();
      msg = payload?.error || msg;
    } catch {}
    if (res.status === 401 || res.status === 403) {
      const err = new Error(msg);
      err.name = "AuthError";
      throw err;
    }
    throw new Error(msg);
  }

  return res.json();
}

export function usePrivatbank(enabled = true) {
  const [credentials, setCredentials] = useState(() =>
    enabled ? loadStoredCreds() : { id: "", token: "" },
  );
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncState, setSyncState] = useState({
    status: "idle",
    source: "none",
    lastSuccess: null,
    lastError: "",
  });

  const { id: storedId, token: storedToken } = credentials;

  const fetchTransactions = async (merchantId, merchantToken, accs) => {
    setLoadingTx(true);
    setSyncState((s) => ({ ...s, status: "loading", source: "none" }));
    try {
      const now = new Date();
      const startDate = fmtDate(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      );
      const endDate = fmtDate(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      );

      const allTxs = [];
      for (const acc of accs) {
        try {
          const data = await apiFetch(
            merchantId,
            merchantToken,
            "/statements/transactions",
            {
              acc: acc.id,
              startDate,
              endDate,
              country: "UA",
              limit: "500",
            },
          );

          const rows =
            data?.StatementsResponse?.data ||
            data?.data ||
            (Array.isArray(data) ? data : []);

          const normalized = rows.map((r) =>
            normalizePrivatTransaction(r, acc.id),
          );
          allTxs.push(...normalized);
        } catch (e) {
          if (e.name === "AuthError") throw e;
          console.warn(`[privat] failed for account ${acc.id}:`, e.message);
        }
      }

      const unique = Array.from(
        new Map(allTxs.map((t) => [t.id, t])).values(),
      ).sort((a, b) => b.time - a.time);

      setTransactions(unique);
      saveTxCache(unique);
      const now2 = new Date();
      setLastUpdated(now2);
      setSyncState({
        status: "success",
        source: "network",
        lastSuccess: now2,
        lastError: "",
      });
    } catch (e) {
      if (e.name === "AuthError") {
        setError(
          "Невірні credentials PrivatBank. Перевірте Merchant ID та токен.",
        );
        setSyncState((s) => ({
          ...s,
          status: "error",
          lastError: e.message,
        }));
        return;
      }
      const cached = loadTxCache();
      if (cached) {
        setTransactions(cached.txs);
        setLastUpdated(new Date(cached.timestamp));
        setSyncState((s) => ({
          ...s,
          status: "partial",
          source: "cache",
          lastError: e.message,
        }));
      } else {
        setSyncState((s) => ({
          ...s,
          status: "error",
          source: "none",
          lastError: e.message,
        }));
      }
      setError(e.message || "Помилка завантаження транзакцій PrivatBank");
    } finally {
      setLoadingTx(false);
    }
  };

  const connect = async (merchantId, merchantToken, remember = false) => {
    setConnecting(true);
    setError("");

    const cleanId = (merchantId || "").trim();
    const cleanToken = (merchantToken || "").trim();

    if (!cleanId || !cleanToken) {
      setError("Введіть Merchant ID та токен");
      setConnecting(false);
      return;
    }

    try {
      const cachedAccounts = loadBalanceCache();
      let accs;

      if (cachedAccounts) {
        accs = cachedAccounts;
      } else {
        const data = await apiFetch(
          cleanId,
          cleanToken,
          "/statements/balance/final",
          {
            country: "UA",
            showRest: "true",
          },
        );

        const rawAccs =
          data?.StatementsResponse?.data ||
          data?.data ||
          (Array.isArray(data) ? data : []);

        accs = rawAccs.map(normalizeAccount);
        saveBalanceCache(accs);
      }

      setAccounts(accs);
      setConnected(true);
      saveCreds(cleanId, cleanToken, remember);
      setCredentials({ id: cleanId, token: cleanToken });

      const cached = loadTxCache();
      if (cached) {
        setTransactions(cached.txs);
        setLastUpdated(new Date(cached.timestamp));
        setSyncState({
          status: "success",
          source: "cache",
          lastSuccess: new Date(cached.timestamp),
          lastError: "",
        });
      } else {
        await fetchTransactions(cleanId, cleanToken, accs);
      }
    } catch (e) {
      if (e.name === "AuthError") {
        setError(
          "Невірні credentials PrivatBank. Перевірте Merchant ID та токен.",
        );
      } else {
        setError(e.message || "Помилка підключення до PrivatBank");
      }
    } finally {
      setConnecting(false);
    }
  };

  const refresh = async () => {
    if (!storedId || !storedToken) return;
    try {
      const data = await apiFetch(
        storedId,
        storedToken,
        "/statements/balance/final",
        {
          country: "UA",
          showRest: "true",
        },
      );
      const rawAccs =
        data?.StatementsResponse?.data ||
        data?.data ||
        (Array.isArray(data) ? data : []);
      const accs = rawAccs.map(normalizeAccount);
      setAccounts(accs);
      saveBalanceCache(accs);
      await fetchTransactions(storedId, storedToken, accs);
    } catch (e) {
      setError(e.message || "Помилка оновлення PrivatBank");
    }
  };

  const disconnect = () => {
    clearCreds();
    setCredentials({ id: "", token: "" });
    setAccounts([]);
    setTransactions([]);
    setConnected(false);
    setError("");
    setSyncState({
      status: "idle",
      source: "none",
      lastSuccess: null,
      lastError: "",
    });
    try {
      localStorage.removeItem(PRIVAT_CACHE_KEY);
      localStorage.removeItem(PRIVAT_BALANCE_KEY);
    } catch {}
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(PRIVAT_CACHE_KEY);
      localStorage.removeItem(PRIVAT_BALANCE_KEY);
    } catch {}
    setTransactions([]);
    setAccounts([]);
    setLastUpdated(null);
  };

  const connectRef = useRef(null);
  connectRef.current = connect;

  useEffect(() => {
    if (!enabled) return;
    if (storedId && storedToken) {
      setConnected(true);
      connectRef.current(storedId, storedToken, false);
    }
  }, [enabled, storedId, storedToken]);

  return {
    merchantId: storedId,
    connected,
    accounts,
    transactions,
    connecting,
    loadingTx,
    error,
    lastUpdated,
    syncState,
    connect,
    refresh,
    disconnect,
    clearCache,
  };
}
