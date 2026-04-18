import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { chatApi, isApiError } from "@shared/api";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { perfMark, perfEnd } from "@shared/lib/perf";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";

import {
  HUB_FINYK_CACHE_EVENT,
  CONTEXT_TTL_MS,
  CHAT_HISTORY_WRITE_DEBOUNCE_MS,
  friendlyApiError,
  friendlyChatError,
  consumeHubChatSse,
  newMsgId,
  makeAssistantMsg,
  makeUserMsg,
  normalizeStoredMessages,
  checkHasMonoData,
  requestIdle,
  cancelIdle,
} from "./lib/hubChatUtils.js";
import { buildContextMeasured } from "./lib/hubChatContext.js";
import { executeAction } from "./lib/hubChatActions.js";
import { VOICE_KEYWORDS, speak, stopSpeaking } from "./lib/hubChatSpeech.js";
import { ChatMessage, TypingIndicator } from "./components/ChatMessage.jsx";
import { ChatInput } from "./components/ChatInput.jsx";

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

function HubChat({ onClose, initialMessage }) {
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

  const lastMessagesRef = useRef(messages);
  useEffect(() => {
    lastMessagesRef.current = messages;
  }, [messages]);

  // Debounced history write
  useEffect(() => {
    const m = perfMark("hubchat:historyWrite(schedule)");
    const id = setTimeout(() => {
      const mm = perfMark("hubchat:historyWrite");
      try {
        localStorage.setItem(
          "hub_chat_history",
          JSON.stringify(lastMessagesRef.current.slice(-30)),
        );
      } catch {}
      perfEnd(mm);
    }, CHAT_HISTORY_WRITE_DEBOUNCE_MS);
    perfEnd(m);
    return () => clearTimeout(id);
  }, [messages]);

  // Flush on unload
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(
          "hub_chat_history",
          JSON.stringify(lastMessagesRef.current.slice(-30)),
        );
      } catch {}
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const chatRef = useRef(null);
  const panelRef = useRef(null);
  const lastWasVoice = useRef(false);

  useEffect(() => {
    if (initialMessage) {
      setInput(initialMessage);
    }
  }, [initialMessage]);

  const [hasData, setHasData] = useState(() => checkHasMonoData());
  const online = useOnlineStatus();

  // Context cache
  const contextRef = useRef({ text: "", ts: 0 });
  const [contextState, setContextState] = useState({ status: "idle", ts: 0 });
  const idleJobRef = useRef(null);

  const scheduleContextBuild = useCallback((reason = "auto", force = false) => {
    const now = Date.now();
    if (
      !force &&
      contextRef.current.text &&
      now - contextRef.current.ts < CONTEXT_TTL_MS
    ) {
      setContextState((s) =>
        s.status === "ready"
          ? s
          : { status: "ready", ts: contextRef.current.ts },
      );
      return;
    }
    if (idleJobRef.current) cancelIdle(idleJobRef.current);
    setContextState({ status: "building", ts: contextRef.current.ts || 0 });
    idleJobRef.current = requestIdle(() => {
      idleJobRef.current = null;
      const m = perfMark(`hubchat:contextBuild(${reason})`);
      const text = buildContextMeasured();
      contextRef.current = { text, ts: Date.now() };
      perfEnd(m, { len: text?.length || 0 });
      setContextState({ status: "ready", ts: contextRef.current.ts });
    });
  }, []);

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

  useEffect(() => {
    scheduleContextBuild("mount", true);
    return () => {
      if (idleJobRef.current) cancelIdle(idleJobRef.current);
    };
  }, [scheduleContextBuild]);

  useEffect(() => {
    const onUpdate = () => scheduleContextBuild("finyk-cache", true);
    window.addEventListener(HUB_FINYK_CACHE_EVENT, onUpdate);
    return () => window.removeEventListener(HUB_FINYK_CACHE_EVENT, onUpdate);
  }, [scheduleContextBuild]);

  const quickPrompts = useMemo(
    () => (hasData ? QUICK_WITH_MONO : QUICK_NO_MONO),
    [hasData],
  );

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  // Focus trap
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

  // TTS speaking state poll
  useEffect(() => {
    if (!speaking) return;
    const id = setInterval(() => {
      if (!window.speechSynthesis?.speaking) setSpeaking(false);
    }, 300);
    return () => clearInterval(id);
  }, [speaking]);

  const sendRef = useRef(null);

  const maybeSpeak = useCallback((text) => {
    speak(text);
    setSpeaking(true);
  }, []);

  const send = async (text, fromVoice = false) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!online) {
      setMessages((m) => [
        ...m,
        makeUserMsg(msg),
        makeAssistantMsg(
          "⚠️ Немає підключення. Асистент працює лише онлайн — спробуй ще раз, коли з'явиться інтернет.",
        ),
      ]);
      setInput("");
      return;
    }

    const shouldSpeak =
      fromVoice || lastWasVoice.current || VOICE_KEYWORDS.test(msg);
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
      const context = contextRef.current.text || buildContextMeasured();
      if (!contextRef.current.text) {
        contextRef.current = { text: context, ts: Date.now() };
        setContextState({ status: "ready", ts: contextRef.current.ts });
      }

      let data;
      try {
        data = await chatApi.send({ context, messages: history });
      } catch (err) {
        if (isApiError(err) && err.kind === "http") {
          throw new Error(friendlyApiError(err.status, err.serverMessage));
        }
        if (isApiError(err) && err.kind === "parse") {
          throw new Error("Некоректна відповідь сервера");
        }
        throw err;
      }

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
          const res2 = await chatApi.stream({
            context: contextRef.current.text || context,
            messages: history,
            tool_results: toolResults,
            tool_calls_raw: data.tool_calls_raw,
            stream: true,
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
        scheduleContextBuild("after-tools", true);
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

  const sessionInfo = useMemo(() => {
    const uiMsgs = Array.isArray(messages) ? messages : [];
    const history = uiMsgs
      .filter((x) => x?.role === "user" || x?.role === "assistant")
      .slice(-10);
    const chars = history.reduce(
      (acc, x) => acc + String(x?.text || "").length,
      0,
    );
    return { historyCount: history.length, chars };
  }, [messages]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col safe-area-pt-pb">
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
                {hasData
                  ? "Фінік · Фізрук · Рутина · Харчування"
                  : "Mono не підключено"}
              </div>
              <div className="text-[10px] text-subtle mt-0.5">
                {contextState.status === "building"
                  ? "Готую контекст…"
                  : contextState.status === "ready"
                    ? "Контекст готовий"
                    : ""}
              </div>
              <div className="text-[10px] text-subtle mt-0.5">
                Сесія: {sessionInfo.historyCount}/10 · ~
                {Math.round(sessionInfo.chars / 100) / 10}k символів
              </div>
              <p
                id="hub-chat-privacy"
                className="text-[10px] text-subtle mt-1 leading-snug max-w-[min(100%,280px)]"
              >
                Запит і короткий контекст (фінанси, тренування, звички,
                харчування) відправляються на сервер до AI. Не діліться чужим
                пристроєм без потреби.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={clearChat}
              className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors text-xs font-semibold"
              title="Нова сесія (очистити чат)"
              aria-label="Нова сесія (очистити чат)"
            >
              ↻ Нова
            </button>
            <button
              type="button"
              onClick={clearChat}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-danger hover:bg-danger/8 transition-colors"
              title="Очистити чат"
              aria-label="Очистити історію чату"
            >
              <Icon name="trash" size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
              aria-label="Закрити асистента"
            >
              <Icon name="close" size={18} />
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
            <ChatMessage
              key={m.id}
              message={m}
              onSpeak={() => setSpeaking(true)}
            />
          ))}
          {loading && <TypingIndicator />}
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
              disabled={loading || !online}
              className="text-xs px-3 py-1.5 bg-panel border border-line rounded-full text-subtle hover:text-text hover:border-muted whitespace-nowrap transition-colors shrink-0 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        {!online && (
          <div
            role="status"
            className="mx-4 mb-2 mt-1 px-3 py-2 bg-warning/10 border border-warning/30 rounded-xl text-[11px] text-warning text-center shrink-0"
          >
            Асистент недоступний без інтернету. Дані модулів видно офлайн, але
            AI-відповіді потребують підключення.
          </div>
        )}

        {/* Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          loading={loading}
          online={online}
          speaking={speaking}
          setSpeaking={setSpeaking}
          onSend={() => send()}
          sendRef={sendRef}
        />
      </div>
    </div>
  );
}

export default HubChat;
