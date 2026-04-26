import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, chatApi, isApiError } from "@shared/api";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { perfMark, perfEnd } from "@shared/lib/perf";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useVisualKeyboardInset } from "@sergeant/shared";
import { hubKeys } from "@shared/lib/queryKeys";
import { useFinykHubPreview } from "./useFinykHubPreview";

import {
  CONTEXT_TTL_MS,
  CHAT_HISTORY_WRITE_DEBOUNCE_MS,
  friendlyApiError,
  friendlyChatError,
  consumeHubChatSse,
  newMsgId,
  makeAssistantMsg,
  makeUserMsg,
  normalizeStoredMessages,
  requestIdle,
  cancelIdle,
  isHelpCommand,
  getActiveModule,
} from "../lib/hubChatUtils";
import { buildContextMeasured } from "../lib/hubChatContext";
import { executeActions } from "../lib/hubChatActions";
import { VOICE_KEYWORDS, speak, stopSpeaking } from "../lib/hubChatSpeech";
import { buildActionCard } from "../lib/hubChatActionCards";
import type { ChatActionCard } from "../lib/hubChatActionCards";
import { ChatMessage, TypingIndicator } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { ChatQuickActions } from "../components/ChatQuickActions";

function HubChat({
  onClose,
  initialMessage,
  autoSendInitial,
  onOpenCatalogue,
}) {
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
  // AbortController для скасування активного запиту (кнопка "Скасувати").
  // Живе у ref, бо не впливає на рендер — лише даємо можливість
  // натисненням перервати `chatApi.send`/`.stream`, і цим одразу
  // повернути UI у стан готовності (loading=false).
  const abortRef = useRef<AbortController | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastWasVoice = useRef(false);

  useEffect(() => {
    if (!initialMessage) return;
    if (autoSendInitial) {
      // sendRef is assigned during render, so it's available by the
      // time effects fire on first paint.
      sendRef.current?.(initialMessage);
    } else {
      setInput(initialMessage);
    }
  }, [initialMessage, autoSendInitial]);

  const queryClient = useQueryClient();
  const finykPreview = useFinykHubPreview();
  const hasData = finykPreview.data?.hasMonoData ?? false;
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
    scheduleContextBuild("mount", true);
    return () => {
      if (idleJobRef.current) cancelIdle(idleJobRef.current);
    };
  }, [scheduleContextBuild]);

  // Rebuild the chat context whenever the Finyk preview snapshot flips
  // (Monobank sync, clear-cache, disconnect, or a cross-tab storage event).
  // Previously signalled via `HUB_FINYK_CACHE_EVENT`; now driven by RQ
  // invalidation of `hubKeys.preview("finyk")`.
  const finykPreviewUpdatedAt = finykPreview.dataUpdatedAt;
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    scheduleContextBuild("finyk-cache", true);
  }, [finykPreviewUpdatedAt, scheduleContextBuild]);

  // Якщо чат відкрився з-під модуля (через URL hash або подію), беремо
  // контекстні підказки. Helper винесено у hubChatUtils для перевикористання
  // в ChatQuickActions.
  const activeModule = useMemo(() => getActiveModule(), []);

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  // Focus trap + Escape + restore focus to trigger on close. Shared
  // with Sheet / ConfirmDialog / InputDialog so every modal surface
  // gets the same WCAG 2.4.3 focus-order guarantees in one place.
  useDialogFocusTrap(true, panelRef, { onEscape: onClose });

  // On-screen keyboard handling. Without this, when a mobile user taps
  // the chat input, the browser's virtual keyboard covers the field
  // and the send button — visualViewport API tells us the remaining
  // viewport height so we can pad the panel up and keep the input
  // visible. Matches the `kbInsetPx` pattern used by Sheet.
  const kbInsetPx = useVisualKeyboardInset(true);

  // TTS speaking state poll
  useEffect(() => {
    if (!speaking) return;
    const id = setInterval(() => {
      if (!window.speechSynthesis?.speaking) setSpeaking(false);
    }, 300);
    return () => clearInterval(id);
  }, [speaking]);

  const sendRef = useRef(null);
  // Callback ref на `.focus()` ChatInput — використовується після
  // prefill з ChatQuickActions, щоб фокус приходив на input одразу.
  const focusInputRef = useRef<(() => void) | null>(null);

  const maybeSpeak = useCallback((text) => {
    speak(text);
    setSpeaking(true);
  }, []);

  const send = async (text?: string, fromVoice = false) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (isHelpCommand(msg)) {
      // /help no longer renders a wall of markdown — it now opens the
      // catalogue page so the user can browse and tap capabilities.
      setInput("");
      if (onOpenCatalogue) {
        onOpenCatalogue();
      }
      return;
    }

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

    // Створюємо новий AbortController для цієї відправки. Якщо раптом
    // попередній ще живий (не мало б бути — send гардить `loading`), то
    // акуратно abort-имо його. Signal пробрасуємо у chatApi.send/stream.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const signal = ac.signal;

    try {
      const context = contextRef.current.text || buildContextMeasured();
      if (!contextRef.current.text) {
        contextRef.current = { text: context, ts: Date.now() };
        setContextState({ status: "ready", ts: contextRef.current.ts });
      }

      let data;
      try {
        data = await chatApi.send({ context, messages: history }, { signal });
      } catch (err) {
        // Переписуємо `message` на юзер-френдлі, але лишаємося в межах
        // `ApiError` — щоб зовнішній `friendlyChatError` бачив ту саму
        // форму помилки, що й решта викликів, і щоб `isApiError` тут
        // продовжував працювати вгору по стеку.
        if (isApiError(err) && err.kind === "http") {
          throw new ApiError({
            kind: "http",
            message: friendlyApiError(err.status, err.serverMessage),
            status: err.status,
            body: err.body,
            bodyText: err.bodyText,
            url: err.url,
            cause: err,
          });
        }
        if (isApiError(err) && err.kind === "parse") {
          throw new ApiError({
            kind: "parse",
            message: "Некоректна відповідь сервера",
            body: err.body,
            bodyText: err.bodyText,
            url: err.url,
            cause: err,
          });
        }
        throw err;
      }

      if (data.tool_calls && data.tool_calls.length > 0) {
        const handlerResults = await executeActions(data.tool_calls);
        const toolResults = data.tool_calls.map((tc, idx) => ({
          tool_use_id: tc.id,
          content: handlerResults[idx]?.result ?? "",
        }));

        const actionsText = toolResults
          .map((r) => `✅ ${r.content}`)
          .join("\n");
        const prefix = `${actionsText}\n\n`;

        // Будуємо action-картки для відомих tool-ів.
        // Якщо tool невідомий — повертається null, лишається лише текст.
        const cards: ChatActionCard[] = data.tool_calls
          .map((tc, idx) =>
            buildActionCard({
              name: tc.name,
              input: tc.input,
              result: toolResults[idx]?.content || "",
            }),
          )
          .filter((c): c is ChatActionCard => c !== null);

        const assistantId = newMsgId();
        setMessages((m) => [
          ...m,
          {
            id: assistantId,
            role: "assistant",
            text: prefix,
            ...(cards.length > 0 ? { cards } : {}),
          },
        ]);

        let followUpText = "";
        try {
          const res2 = await chatApi.stream(
            {
              context: contextRef.current.text || context,
              messages: history,
              tool_results: toolResults,
              tool_calls_raw: data.tool_calls_raw,
              stream: true,
            },
            { signal },
          );

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
            const parsed = data2 as { error?: string; text?: string };
            if (!res2.ok)
              throw new ApiError({
                kind: "http",
                message: friendlyApiError(res2.status, parsed?.error),
                status: res2.status,
                body: data2,
                bodyText: raw2,
                url: res2.url,
              });
            followUpText = parsed.text || "";
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

        queryClient.invalidateQueries({
          queryKey: hubKeys.preview("finyk"),
        });
        scheduleContextBuild("after-tools", true);
      } else {
        const reply = data.text || "Немає відповіді.";
        setMessages((m) => [...m, makeAssistantMsg(reply)]);
        if (shouldSpeak) maybeSpeak(reply);
      }
    } catch (e) {
      // Явне скасування (кнопка "Скасувати" або закриття чату) не
      // показуємо як помилку — додаємо тихий маркер.
      if (isApiError(e) && e.kind === "aborted") {
        setMessages((m) => [...m, makeAssistantMsg("⏹ Запит скасовано.")]);
      } else if ((e as { name?: string } | null)?.name === "AbortError") {
        setMessages((m) => [...m, makeAssistantMsg("⏹ Запит скасовано.")]);
      } else {
        setMessages((m) => [...m, makeAssistantMsg(friendlyChatError(e))]);
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
    }
  };

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Скасовуємо живий запит, якщо чат закривають прямо під час стріму —
  // інакше fetch продовжує "ганяти" токени у фоні і finally-хендлер
  // спрацьовує вже після unmount (лог у консоль + потенційна race).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);
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
        className="relative mt-auto flex flex-col bg-bg border-t border-line rounded-t-3xl shadow-float max-h-[92dvh] outline-none transition-[margin] duration-150"
        style={kbInsetPx > 0 ? { marginBottom: kbInsetPx } : undefined}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pb-3 shrink-0 border-b border-line">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0 mt-0.5"
              aria-hidden
            >
              <Icon name="sparkle" size={18} className="text-brand-500" />
            </div>
            <div className="min-w-0">
              <div
                id="hub-chat-title"
                className="text-[15px] font-bold text-text leading-snug"
              >
                Асистент
              </div>
              <div
                className={cn(
                  "text-2xs leading-snug mt-0.5",
                  hasData ? "text-subtle" : "text-warning",
                )}
              >
                {hasData
                  ? "Фінік · Фізрук · Рутина · Харчування"
                  : "Mono не підключено"}
              </div>
              <div className="flex items-center gap-1.5 text-2xs text-subtle mt-1">
                <span
                  className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full",
                    contextState.status === "ready"
                      ? "bg-brand-500"
                      : contextState.status === "building"
                        ? "bg-warning animate-pulse"
                        : "bg-line",
                  )}
                />
                <span>
                  {contextState.status === "building"
                    ? "Готую контекст…"
                    : contextState.status === "ready"
                      ? "Контекст готовий"
                      : "Очікую"}
                </span>
                <span className="text-line">·</span>
                <span>
                  {sessionInfo.historyCount}/10 · ~
                  {Math.round(sessionInfo.chars / 100) / 10}k
                </span>
              </div>
              <p
                id="hub-chat-privacy"
                className="text-2xs text-muted/70 mt-1 leading-snug max-w-[min(100%,280px)]"
              >
                Контекст (фінанси, тренування, звички, харчування)
                відправляється до AI.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={clearChat}
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors text-2xs font-semibold"
              title="Очистити історію та почати нову сесію"
              aria-label="Очистити чат"
            >
              <Icon name="refresh-cw" size={13} />
              Новий чат
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
              aria-label="Закрити асистента"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 min-h-0"
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
          {loading && (
            <div className="flex items-center gap-2">
              <TypingIndicator />
              <button
                type="button"
                onClick={cancelInFlight}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-panelHi hover:bg-line/40 text-muted hover:text-text text-2xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
                aria-label="Скасувати поточний запит"
                title="Скасувати (Esc)"
              >
                <Icon name="close" size={12} />
                Скасувати
              </button>
            </div>
          )}
        </div>

        {/* Quick action chips (spec: assistant-quick-actions-v1) */}
        <ChatQuickActions
          activeModule={activeModule}
          loading={loading}
          online={online}
          onSend={(prompt) => send(prompt)}
          onPrefill={(prompt) => {
            setInput(prompt);
            // Невелика затримка, щоб React встиг змонтувати оновлений
            // value у input перш ніж ми поставимо фокус.
            setTimeout(() => focusInputRef.current?.(), 0);
          }}
        />

        {!online && (
          <div
            role="status"
            className="mx-4 mb-2 mt-1 px-3 py-2 bg-warning/10 border border-warning/30 rounded-xl text-xs text-warning text-center shrink-0"
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
          onHelp={() => send("/help")}
          sendRef={sendRef}
          focusInputRef={focusInputRef}
        />
      </div>
    </div>
  );
}

export default HubChat;
