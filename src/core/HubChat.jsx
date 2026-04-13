import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  parseWorkoutsFromStorage,
  WORKOUTS_STORAGE_KEY,
} from "../modules/fizruk/lib/fizrukStorage";
import {
  mergeExpenseCategoryDefinitions,
  INTERNAL_TRANSFER_ID,
} from "../modules/finyk/constants";
import {
  getCategory,
  getMonoTotals,
  getTxStatAmount,
  calcCategorySpent,
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getReceivableEffectiveTotal,
  resolveExpenseCategoryMeta,
} from "../modules/finyk/utils";
import {
  completedWorkoutsCount,
  countCompletedInCurrentWeek,
  totalCompletedVolumeKg,
  weeklyVolumeSeriesNow,
} from "../modules/fizruk/lib/workoutStats";
import { ACTIVE_WORKOUT_KEY } from "../modules/fizruk/lib/workoutUi";
import { cn } from "@shared/lib/cn";

const HUB_FINYK_CACHE_EVENT = "hub-finyk-cache-updated";

function friendlyApiError(status, message) {
  const m = message || "";
  if (status === 500 && /ANTHROPIC|not set|key/i.test(m)) {
    return "Чат на сервері не налаштовано (немає ключа AI).";
  }
  if (status === 429) return "Забагато запитів. Спробуй через хвилину.";
  if (status === 401 || status === 403) return "Доступ заборонено.";
  return m || `Помилка ${status}`;
}

function friendlyChatError(e) {
  const msg = e?.message || String(e);
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return "Немає з'єднання з мережею або сервер недоступний.";
  }
  return `Помилка: ${msg}`;
}

/** Читає SSE з /api/chat (data: {"t":"..."} / [DONE]). Рядок за рядком — стійко до часткових чанків. */
async function consumeHubChatSse(response, onDelta) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (;;) {
      const nl = buf.indexOf("\n");
      if (nl === -1) break;
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      let j;
      try {
        j = JSON.parse(raw);
      } catch {
        continue;
      }
      if (j.err) throw new Error(j.err);
      if (j.t) onDelta(j.t);
    }
  }
}

function AssistantMessageBody({ text }) {
  return (
    <ReactMarkdown
      className="text-sm leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline"
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function newMsgId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `m_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  );
}

function makeAssistantMsg(text) {
  return { id: newMsgId(), role: "assistant", text };
}

function makeUserMsg(text) {
  return { id: newMsgId(), role: "user", text };
}

function normalizeStoredMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      makeAssistantMsg(
        "Привіт! Запитуй про фінанси чи тренування. Можу також змінювати категорії, додавати борги тощо.",
      ),
    ];
  }
  return raw.map((m, i) => ({
    ...m,
    id:
      m.id ||
      `legacy_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  }));
}

// ──────────────────────────────────────────────
// 1. Пряме читання localStorage — єдине джерело правди
// ──────────────────────────────────────────────

function ls(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function checkHasMonoData() {
  try {
    const c = ls("finyk_tx_cache", null);
    return !!c?.txs?.length;
  } catch {
    return false;
  }
}

function readAllData() {
  const txCache = ls("finyk_tx_cache", null);
  const infoCache = ls("finyk_info_cache", null);

  const transactions = txCache?.txs || [];
  const accounts = infoCache?.accounts || [];
  const clientName = infoCache?.name || "";
  const cacheTime = txCache?.timestamp || null;

  const hiddenAccounts = ls("finyk_hidden", []);
  const budgets = ls("finyk_budgets", []);
  const manualDebts = ls("finyk_debts", []);
  const receivables = ls("finyk_recv", []);
  const hiddenTxIds = ls("finyk_hidden_txs", []);
  const txCategories = ls("finyk_tx_cats", {});
  const txSplits = ls("finyk_tx_splits", {});
  const customCategories = ls("finyk_custom_cats_v1", []);
  const monthlyPlan = ls("finyk_monthly_plan", {});
  const subscriptions = ls("finyk_subs", []);
  const monoDebtLinked = ls("finyk_mono_debt_linked", {});

  const transferTxIds = Object.entries(txCategories)
    .filter(([, catId]) => catId === INTERNAL_TRANSFER_ID)
    .map(([txId]) => txId);

  const excludedIds = new Set([
    ...hiddenTxIds,
    ...transferTxIds,
    ...receivables.flatMap((r) => r.linkedTxIds || []),
  ]);

  const statTx = transactions.filter((t) => !excludedIds.has(t.id));

  return {
    transactions,
    accounts,
    clientName,
    cacheTime,
    hiddenAccounts,
    budgets,
    manualDebts,
    receivables,
    txCategories,
    txSplits,
    customCategories,
    monthlyPlan,
    subscriptions,
    monoDebtLinked,
    statTx,
    excludedIds,
  };
}

function fmt(n) {
  return Math.round(n).toLocaleString("uk-UA");
}

function buildContext() {
  const d = readAllData();
  const lines = [];

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  lines.push(
    `[Сьогодні] ${now.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
  );
  lines.push(
    `[День місяця] ${dayOfMonth} з ${daysInMonth} (залишилось ${daysLeft} днів)`,
  );

  if (d.cacheTime) {
    const ts = new Intl.DateTimeFormat("uk-UA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d.cacheTime));
    lines.push(`[Оновлено] ${ts}`);
  }
  if (d.clientName) lines.push(`[Користувач] ${d.clientName}`);

  if (d.accounts.length > 0) {
    const { balance, debt: monoDebt } = getMonoTotals(
      d.accounts,
      d.hiddenAccounts,
    );
    const manualDebtTotal = d.manualDebts.reduce(
      (s, debt) => s + calcDebtRemaining(debt, d.transactions),
      0,
    );
    lines.push(`[Баланс карток] ${fmt(balance)} грн`);
    lines.push(`[Борг кредитки] ${fmt(monoDebt)} грн`);
    if (manualDebtTotal > 0)
      lines.push(`[Борг ручний] ${fmt(manualDebtTotal)} грн`);
    lines.push(`[Борг загальний] ${fmt(monoDebt + manualDebtTotal)} грн`);
  }

  if (d.statTx.length > 0) {
    const spent = d.statTx
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + getTxStatAmount(t, d.txSplits), 0);
    const income = d.statTx
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount / 100, 0);
    const avgPerDay = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    const projected = avgPerDay * daysInMonth;

    lines.push(`[Витрати місяця] ${fmt(spent)} грн`);
    lines.push(`[Дохід місяця] ${fmt(income)} грн`);
    lines.push(`[Баланс місяця] ${fmt(income - spent)} грн`);
    lines.push(`[Середня витрата/день] ${fmt(avgPerDay)} грн`);
    lines.push(`[Прогноз витрат до кінця місяця] ${fmt(projected)} грн`);

    const cats = mergeExpenseCategoryDefinitions(d.customCategories)
      .filter((c) => c.id !== "income" && c.id !== INTERNAL_TRANSFER_ID)
      .map((c) => ({
        id: c.id,
        label: c.label,
        spent: calcCategorySpent(
          d.statTx,
          c.id,
          d.txCategories,
          d.txSplits,
          d.customCategories,
        ),
      }))
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    if (cats.length > 0) {
      lines.push(
        `[Категорії витрат] ${cats.map((c) => `${c.label}: ${fmt(c.spent)} грн`).join(", ")}`,
      );
    }

    const recent = [...d.statTx]
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 10);
    if (recent.length > 0) {
      lines.push("[Останні операції]");
      recent.forEach((t) => {
        const cat = getCategory(
          t.description,
          t.mcc,
          d.txCategories[t.id],
          d.customCategories,
        );
        const date = t.time
          ? new Date(t.time * 1000).toLocaleDateString("uk-UA", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        lines.push(
          `  id:${t.id} | ${date} | ${t.description || "—"} | ${fmt(t.amount / 100)} грн | ${cat.label}`,
        );
      });
    }
  }

  if (d.manualDebts.filter((x) => Number(x.totalAmount) > 0).length > 0) {
    lines.push(
      `[Деталі боргів] ${d.manualDebts
        .filter((x) => Number(x.totalAmount) > 0)
        .map((x) => {
          const rem = calcDebtRemaining(x, d.transactions);
          const eff = getDebtEffectiveTotal(x, d.transactions);
          return `${x.name}: залишок ${fmt(rem)} грн (сума з виникненнями ${fmt(eff)} грн, id:${x.id})`;
        })
        .join(", ")}`,
    );
  }

  const recv = d.receivables.filter((r) => Number(r.amount) > 0);
  if (recv.length > 0) {
    lines.push(
      `[Мені винні] ${recv
        .map((r) => {
          const rem = calcReceivableRemaining(r, d.transactions);
          const eff = getReceivableEffectiveTotal(r, d.transactions);
          return `${r.name}: залишок ${fmt(rem)} грн (ефективна сума ${fmt(eff)} грн, id:${r.id})`;
        })
        .join(", ")}`,
    );
  }

  const limits = d.budgets.filter((b) => b.type === "limit");
  if (limits.length > 0) {
    const statTx = d.statTx;
    lines.push(
      `[Ліміти] ${limits
        .map((b) => {
          const cat = resolveExpenseCategoryMeta(
            b.categoryId,
            d.customCategories,
          );
          const spent = calcCategorySpent(
            statTx,
            b.categoryId,
            d.txCategories,
            d.txSplits,
            d.customCategories,
          );
          return `${cat?.label || b.categoryId}: ${fmt(spent)}/${fmt(b.limit)} грн`;
        })
        .join(", ")}`,
    );
  }

  const goals = d.budgets.filter((b) => b.type === "goal");
  if (goals.length > 0) {
    lines.push(
      `[Цілі] ${goals.map((b) => `${b.name}: ${fmt(b.savedAmount || 0)}/${fmt(b.targetAmount)} грн`).join(", ")}`,
    );
  }

  if (d.monthlyPlan?.income || d.monthlyPlan?.expense) {
    lines.push(
      `[Фінплан] дохід ${fmt(d.monthlyPlan.income || 0)} грн/міс, витрати ${fmt(d.monthlyPlan.expense || 0)} грн/міс`,
    );
  }

  if (d.subscriptions?.length > 0) {
    lines.push(`[Підписки] ${d.subscriptions.map((s) => s.name).join(", ")}`);
  }

  // Доступні категорії для зміни
  lines.push(
    `[Категорії] ${mergeExpenseCategoryDefinitions(d.customCategories)
      .map((c) => `${c.id}="${c.label}"`)
      .join(", ")}`,
  );

  try {
    const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
    const w = parseWorkoutsFromStorage(raw);
    if (Array.isArray(w) && w.length > 0) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const withTs = w.map((x) => ({
        ...x,
        _ts: new Date(x.startedAt).getTime(),
      }));
      const cnt = withTs.filter((x) => x._ts > weekAgo).length;
      const sorted = [...withTs].sort((a, b) => b._ts - a._ts);
      const last = sorted[0];
      const dt = last
        ? new Date(last.startedAt).toLocaleDateString("uk-UA", {
            day: "numeric",
            month: "short",
          })
        : "—";
      lines.push(
        `[Тренування] завершених всього: ${completedWorkoutsCount(w)}, цього тижня завершено: ${countCompletedInCurrentWeek(w)}, за останні 7 днів сесій: ${cnt}, остання дата: ${dt}`,
      );
      const { volumeKg } = weeklyVolumeSeriesNow(w);
      const weekVol = volumeKg.reduce((a, b) => a + b, 0);
      lines.push(`[Фізрук тиждень] обʼєм кг×повт (Пн–Нд): ${fmt(weekVol)}`);
      lines.push(
        `[Фізрук загалом] сумарний обʼєм завершених: ${fmt(totalCompletedVolumeKg(w))} кг×повт`,
      );
      let activeHint = "немає";
      try {
        const aid = localStorage.getItem(ACTIVE_WORKOUT_KEY);
        if (aid) {
          const aw = w.find((x) => x.id === aid && !x.endedAt);
          if (aw)
            activeHint = `${(aw.items || []).length} вправ у поточній сесії (id тренування ${aid})`;
        }
      } catch {}
      lines.push(`[Фізрук активне тренування] ${activeHint}`);
      if (sorted.length > 0 && sorted[0].items?.length > 0) {
        const exercises = sorted[0].items
          .map((i) => i.nameUk || i.name || i.exercise || "—")
          .join(", ");
        lines.push(`[Останнє тренування вправи] ${exercises}`);
      }
    }
  } catch {}

  return lines.length > 1
    ? lines.join("\n")
    : "Даних немає. Monobank не підключено.";
}

// ──────────────────────────────────────────────
// 2. Виконання дій (tool results)
// ──────────────────────────────────────────────

function executeAction(action) {
  try {
    switch (action.name) {
      case "change_category": {
        const { tx_id, category_id } = action.input;
        const cats = ls("finyk_tx_cats", {});
        cats[tx_id] = category_id;
        lsSet("finyk_tx_cats", cats);
        const customC = ls("finyk_custom_cats_v1", []);
        const cat = resolveExpenseCategoryMeta(category_id, customC);
        return `Категорію транзакції ${tx_id} змінено на ${cat?.label || category_id}`;
      }
      case "create_debt": {
        const { name, amount, due_date, emoji } = action.input;
        const debts = ls("finyk_debts", []);
        const newDebt = {
          id: `d_${Date.now()}`,
          name,
          totalAmount: Number(amount),
          dueDate: due_date || "",
          emoji: emoji || "💸",
          linkedTxIds: [],
        };
        debts.push(newDebt);
        lsSet("finyk_debts", debts);
        return `Борг "${name}" на ${amount} грн створено (id:${newDebt.id})`;
      }
      case "create_receivable": {
        const { name, amount } = action.input;
        const recv = ls("finyk_recv", []);
        const newRecv = {
          id: `r_${Date.now()}`,
          name,
          amount: Number(amount),
          linkedTxIds: [],
        };
        recv.push(newRecv);
        lsSet("finyk_recv", recv);
        return `Дебіторку "${name}" на ${amount} грн додано (id:${newRecv.id})`;
      }
      case "hide_transaction": {
        const { tx_id } = action.input;
        const hidden = ls("finyk_hidden_txs", []);
        if (!hidden.includes(tx_id)) {
          hidden.push(tx_id);
          lsSet("finyk_hidden_txs", hidden);
        }
        return `Транзакцію ${tx_id} приховано зі статистики`;
      }
      case "set_budget_limit": {
        const { category_id, limit } = action.input;
        const budgets = ls("finyk_budgets", []);
        const idx = budgets.findIndex(
          (b) => b.type === "limit" && b.categoryId === category_id,
        );
        if (idx >= 0) {
          budgets[idx].limit = Number(limit);
        } else {
          budgets.push({
            id: `b_${Date.now()}`,
            type: "limit",
            categoryId: category_id,
            limit: Number(limit),
          });
        }
        lsSet("finyk_budgets", budgets);
        const customC = ls("finyk_custom_cats_v1", []);
        const cat = resolveExpenseCategoryMeta(category_id, customC);
        return `Ліміт ${cat?.label || category_id} встановлено: ${limit} грн`;
      }
      case "set_monthly_plan": {
        const { income, expense, savings } = action.input;
        const cur = ls("finyk_monthly_plan", {});
        const next = { ...cur };
        if (income != null && income !== "") next.income = String(income);
        if (expense != null && expense !== "") next.expense = String(expense);
        if (savings != null && savings !== "") next.savings = String(savings);
        lsSet("finyk_monthly_plan", next);
        return `Фінплан місяця оновлено: дохід ${next.income ?? "—"} / витрати ${next.expense ?? "—"} / заощадження ${next.savings ?? "—"} грн/міс`;
      }
      default:
        return `Невідома дія: ${action.name}`;
    }
  } catch (e) {
    return `Помилка виконання: ${e.message}`;
  }
}

// ──────────────────────────────────────────────
// 3. Speech Recognition (input)
// ──────────────────────────────────────────────

function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggle = useCallback(() => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (listening) {
      recRef.current?.abort();
      setListening(false);
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "uk-UA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) cbRef.current(transcript);
    };
    rec.onerror = (e) => {
      console.warn("Speech error:", e.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, supported]);

  return { listening, toggle, supported };
}

// ──────────────────────────────────────────────
// 3b. Speech Synthesis (output)
// ──────────────────────────────────────────────

const VOICE_KEYWORDS = /голосом|вголос|скажи|озвуч|прочитай/i;

function cleanTextForSpeech(text) {
  return text
    .replace(/✅/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/id:\S+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[_*#~`|]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getUkVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "uk-UA") ||
    voices.find((v) => v.lang.startsWith("uk")) ||
    voices.find((v) => v.lang.startsWith("ru")) ||
    null
  );
}

// iOS Safari блокує speechSynthesis.speak() якщо виклик не з user gesture.
// Цей трюк "розблоковує" аудіо: пустий utterance з обробника кліку.
function unlockTTS() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance("");
  utter.volume = 0;
  utter.lang = "uk-UA";
  window.speechSynthesis.speak(utter);
}

function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const clean = cleanTextForSpeech(text);
  if (!clean) return;

  window.speechSynthesis.cancel();

  const doSpeak = () => {
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "uk-UA";
    utter.rate = 1.0;
    utter.pitch = 1;
    const voice = getUkVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.addEventListener("voiceschanged", doSpeak, {
      once: true,
    });
    setTimeout(() => {
      if (window.speechSynthesis.speaking) return;
      doSpeak();
    }, 500);
  }
}

function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ──────────────────────────────────────────────
// 4. Chat component
// ──────────────────────────────────────────────

const QUICK_WITH_MONO = [
  "Як справи з бюджетом?",
  "Які борги маю?",
  "Скільки витратив?",
  "Порадь щось",
];

const QUICK_NO_MONO = [
  "Як почати тренування у Фізруку?",
  "Що ти знаєш про мої тренування?",
  "Порадь розминку перед залом",
  "Порадь щось",
];

function HubChat({ onClose }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("hub_chat_history");
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p) && p.length) return normalizeStoredMessages(p);
      }
    } catch {}
    return normalizeStoredMessages(null);
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "hub_chat_history",
        JSON.stringify(messages.slice(-30)),
      );
    } catch {}
  }, [messages]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const lastWasVoice = useRef(false);

  const [hasData, setHasData] = useState(() => checkHasMonoData());

  useEffect(() => {
    const refresh = () => setHasData(checkHasMonoData());
    window.addEventListener("storage", refresh);
    window.addEventListener(HUB_FINYK_CACHE_EVENT, refresh);
    window.addEventListener("focus", refresh);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HUB_FINYK_CACHE_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const quickPrompts = useMemo(
    () => (hasData ? QUICK_WITH_MONO : QUICK_NO_MONO),
    [hasData],
  );

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = getFocusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Відстежуємо чи speechSynthesis ще говорить
  useEffect(() => {
    if (!speaking) return;
    const id = setInterval(() => {
      if (!window.speechSynthesis?.speaking) setSpeaking(false);
    }, 300);
    return () => clearInterval(id);
  }, [speaking]);

  const sendRef = useRef(null);

  const {
    listening,
    toggle: rawToggleMic,
    supported: speechSupported,
  } = useSpeech((text) => {
    if (text.trim()) {
      lastWasVoice.current = true;
      sendRef.current?.(text.trim());
    }
  });

  const toggleMic = useCallback(() => {
    unlockTTS();
    rawToggleMic();
  }, [rawToggleMic]);

  const maybeSpeak = useCallback((text) => {
    speak(text);
    setSpeaking(true);
  }, []);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const shouldSpeak = lastWasVoice.current || VOICE_KEYWORDS.test(msg);
    lastWasVoice.current = false;

    const userMsg = makeUserMsg(msg);
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const history = next
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const context = buildContext();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, messages: history }),
      });
      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          res.ok ? "Некоректна відповідь сервера" : `Помилка ${res.status}`,
        );
      }
      if (!res.ok) throw new Error(friendlyApiError(res.status, data?.error));

      if (data.tool_calls && data.tool_calls.length > 0) {
        const toolResults = data.tool_calls.map((tc) => ({
          tool_use_id: tc.id,
          content: executeAction(tc),
        }));

        const actionsText = toolResults
          .map((r) => `✅ ${r.content}`)
          .join("\n");
        const prefix = `${actionsText}\n\n`;
        const assistantId = newMsgId();
        setMessages((m) => [
          ...m,
          { id: assistantId, role: "assistant", text: prefix },
        ]);

        let followUpText = "";
        try {
          const res2 = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: buildContext(),
              messages: history,
              tool_results: toolResults,
              tool_calls_raw: data.tool_calls_raw,
              stream: true,
            }),
          });

          const ct = res2.headers.get("content-type") || "";
          if (res2.ok && ct.includes("text/event-stream")) {
            let acc = "";
            await consumeHubChatSse(res2, (delta) => {
              acc += delta;
              setMessages((m) =>
                m.map((x) =>
                  x.id === assistantId ? { ...x, text: prefix + acc } : x,
                ),
              );
            });
            followUpText = acc;
          } else {
            const raw2 = await res2.text();
            let data2 = {};
            try {
              data2 = raw2 ? JSON.parse(raw2) : {};
            } catch {
              data2 = { error: raw2 };
            }
            if (!res2.ok)
              throw new Error(friendlyApiError(res2.status, data2?.error));
            followUpText = data2.text || "";
            setMessages((m) =>
              m.map((x) =>
                x.id === assistantId
                  ? { ...x, text: prefix + followUpText }
                  : x,
              ),
            );
          }
        } catch (e2) {
          setMessages((m) =>
            m.map((x) =>
              x.id === assistantId
                ? { ...x, text: `${prefix}\n\n${friendlyChatError(e2)}` }
                : x,
            ),
          );
        }

        if (shouldSpeak) {
          const speakTarget = followUpText || actionsText;
          if (speakTarget) maybeSpeak(speakTarget);
        }

        window.dispatchEvent(new CustomEvent(HUB_FINYK_CACHE_EVENT));
      } else {
        const reply = data.text || "Немає відповіді.";
        setMessages((m) => [...m, makeAssistantMsg(reply)]);
        if (shouldSpeak) maybeSpeak(reply);
      }
    } catch (e) {
      setMessages((m) => [...m, makeAssistantMsg(friendlyChatError(e))]);
    } finally {
      setLoading(false);
    }
  };
  sendRef.current = send;

  const clearChat = () => {
    stopSpeaking();
    setSpeaking(false);
    setMessages([makeAssistantMsg("Чат очищено.")]);
    try {
      localStorage.removeItem("hub_chat_history");
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top,0px)",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-chat-title"
        aria-describedby="hub-chat-privacy"
        className="relative mt-auto flex flex-col bg-bg border-t border-line rounded-t-3xl shadow-float max-h-[92dvh] outline-none"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-line/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0" aria-hidden>
              🤖
            </span>
            <div className="min-w-0">
              <div
                id="hub-chat-title"
                className="text-sm font-semibold text-text"
              >
                Асистент
              </div>
              <div
                className={cn(
                  "text-[10px]",
                  hasData ? "text-subtle" : "text-warning",
                )}
              >
                {hasData ? "Фінік · Фізрук" : "Mono не підключено"}
              </div>
              <p
                id="hub-chat-privacy"
                className="text-[10px] text-subtle mt-1 leading-snug max-w-[min(100%,280px)]"
              >
                Запит і короткий контекст (фінанси/тренування) відправляються на
                сервер до AI. Не діліться чужим пристроєм без потреби.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={clearChat}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-danger hover:bg-danger/8 transition-colors"
              title="Очистити чат"
              aria-label="Очистити історію чату"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
              aria-label="Закрити асистента"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                m.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              {m.role === "assistant" && (
                <span className="text-lg shrink-0 mb-0.5 leading-none">🤖</span>
              )}
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-panel border border-line text-text rounded-bl-sm whitespace-normal",
                )}
              >
                {m.role === "assistant" ? (
                  <AssistantMessageBody text={m.text} />
                ) : (
                  m.text
                )}
                {m.role === "assistant" && m.text && m.text.length > 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      speak(m.text);
                      setSpeaking(true);
                    }}
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-subtle hover:text-text transition-colors"
                    title="Озвучити"
                    aria-label="Озвучити відповідь"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                    Озвучити
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2">
              <span className="text-lg shrink-0 mb-0.5 leading-none">🤖</span>
              <div className="bg-panel border border-line rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                {[0, 0.15, 0.3].map((d, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div
          className="flex gap-2 px-4 pt-2 pb-1 overflow-x-auto scrollbar-hide shrink-0"
          role="group"
          aria-label="Швидкі запити"
        >
          {quickPrompts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-panel border border-line rounded-full text-subtle hover:text-text hover:border-muted whitespace-nowrap transition-colors shrink-0 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2 px-4 pt-2 pb-4 shrink-0">
          <input
            ref={inputRef}
            className="flex-1 bg-panel border border-line rounded-2xl px-4 py-3 text-sm text-text outline-none focus:border-primary/60 placeholder:text-subtle transition-colors"
            placeholder="Запитай або попроси змінити щось…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            aria-label="Повідомлення асистенту"
          />
          {speaking ? (
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setSpeaking(false);
              }}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all border bg-warning/15 border-warning text-warning animate-pulse"
              title="Зупинити озвучення"
              aria-label="Зупинити озвучення"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : speechSupported ? (
            <button
              type="button"
              onClick={toggleMic}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all border",
                listening
                  ? "bg-danger text-white border-danger animate-pulse"
                  : "bg-panel border-line text-muted hover:text-text hover:border-muted",
              )}
              title={listening ? "Зупинити запис" : "Голосовий ввід"}
              aria-label={listening ? "Зупинити запис" : "Голосовий ввід"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={listening ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:brightness-110 transition-all disabled:opacity-40"
            aria-label="Надіслати"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default HubChat;
