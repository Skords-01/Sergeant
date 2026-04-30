import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, chatApi, isApiError } from "@shared/api";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import {
  Popover,
  PopoverItem,
  PopoverDivider,
} from "@shared/components/ui/Popover";
import { Tooltip } from "@shared/components/ui/Tooltip";
import { perfMark, perfEnd } from "@shared/lib/perf";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useToast } from "@shared/hooks/useToast";
import { showUndoToast } from "@shared/lib/undoToast";
import { useVisualKeyboardInset } from "@sergeant/shared";
import { hubKeys } from "@shared/lib/queryKeys";
import { useFinykHubPreview } from "./useFinykHubPreview";
import { HubChatHistoryDrawer } from "./HubChatHistoryDrawer";
import {
  createSession,
  deleteSession as deleteSessionFn,
  deriveSessionTitle,
  ensureActiveSession,
  loadActiveSessionId,
  loadSessions,
  saveActiveSessionId,
  saveSessions,
  upsertSession,
  type HubChatSession,
} from "./hubChatSessions";

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

interface HubChatProps {
  onClose: () => void;
  initialMessage?: string;
  autoSendInitial?: boolean;
  onOpenCatalogue?: () => void;
  /**
   * When provided, the chat header gains a "minimize" button that hides
   * the dialog without unmounting it (so messages, draft input and any
   * in-flight request are preserved). The host renders a floating FAB
   * to restore the chat.
   */
  isMinimized?: boolean;
  onMinimize?: () => void;
  /**
   * Called whenever `messages` changes while `isMinimized` is true so
   * the host can drive the unseen-message badge on the FAB. Only the
   * count delta matters — the host owns the actual counter state.
   */
  onUnseenChange?: (count: number) => void;
}

function HubChat({
  onClose,
  initialMessage,
  autoSendInitial,
  onOpenCatalogue,
  isMinimized = false,
  onMinimize,
  onUnseenChange,
}: HubChatProps) {
  const toast = useToast();

  // Multi-session state. `sessions` is the full list shown in the
  // history drawer; `activeId` selects which one drives the visible
  // `messages` array. On first render we run the legacy migration
  // (`hub_chat_history` → `hub_chat_sessions_v1`) inside `loadSessions`
  // so existing users keep their last 30 messages as session #1.
  // The three useState initializers all read from the same eagerly
  // computed snapshot — calling `ensureActiveSession` twice would
  // otherwise mint two independent fresh sessions when storage is
  // empty.
  const initialSessionsRef = useRef<{
    sessions: HubChatSession[];
    activeId: string;
  } | null>(null);
  if (initialSessionsRef.current === null) {
    initialSessionsRef.current = ensureActiveSession(
      loadSessions(),
      loadActiveSessionId(),
    );
  }

  const [sessions, setSessions] = useState<HubChatSession[]>(
    () => initialSessionsRef.current!.sessions,
  );
  const [activeId, setActiveId] = useState<string>(
    () => initialSessionsRef.current!.activeId,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  // Header "Деталі" popover — controlled so item actions (open
  // history drawer, minimize) can dismiss it after the click.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [messages, setMessages] = useState(() => {
    const initial = initialSessionsRef.current!;
    const found = initial.sessions.find((s) => s.id === initial.activeId);
    return normalizeStoredMessages(found?.messages ?? null);
  });

  const lastMessagesRef = useRef(messages);
  useEffect(() => {
    lastMessagesRef.current = messages;
  }, [messages]);

  // Unseen-while-minimized tracking. We snapshot the assistant-message
  // count on the transition `open → minimized`, and on every subsequent
  // change to `messages` we report `current - snapshot` to the host so
  // it can render a numeric badge on the restore FAB. The snapshot is
  // cleared on the transition back to visible (`open`) so re-minimizing
  // starts fresh.
  const minimizedBaselineRef = useRef<number | null>(null);
  useEffect(() => {
    if (isMinimized) {
      if (minimizedBaselineRef.current === null) {
        minimizedBaselineRef.current = messages.filter(
          (m) => m.role === "assistant",
        ).length;
      }
    } else {
      minimizedBaselineRef.current = null;
      onUnseenChange?.(0);
    }
  }, [isMinimized, messages, onUnseenChange]);
  useEffect(() => {
    if (!isMinimized) return;
    const baseline = minimizedBaselineRef.current ?? 0;
    const current = messages.filter((m) => m.role === "assistant").length;
    onUnseenChange?.(Math.max(0, current - baseline));
  }, [messages, isMinimized, onUnseenChange]);

  // Debounced session write — replaces the previous single-key
  // `hub_chat_history` writer. Title is re-derived on every flush so
  // a freshly-typed first user message renames the session in the
  // drawer without a manual rename.
  useEffect(() => {
    const m = perfMark("hubchat:historyWrite(schedule)");
    const id = setTimeout(() => {
      const mm = perfMark("hubchat:historyWrite");
      const current = lastMessagesRef.current;
      setSessions((prev) => {
        const target = prev.find((s) => s.id === activeId);
        if (!target) return prev;
        const next: HubChatSession = {
          ...target,
          title:
            target.title.startsWith("Бесіда ") || target.title === "Нова бесіда"
              ? deriveSessionTitle(current, target.createdAt)
              : target.title,
          updatedAt: Date.now(),
          messages: current,
        };
        const updated = upsertSession(prev, next);
        saveSessions(updated);
        return updated;
      });
      perfEnd(mm);
    }, CHAT_HISTORY_WRITE_DEBOUNCE_MS);
    perfEnd(m);
    return () => clearTimeout(id);
  }, [messages, activeId]);

  // Flush on unload (skip the debounce — the user is leaving).
  useEffect(() => {
    const flush = () => {
      setSessions((prev) => {
        const target = prev.find((s) => s.id === activeId);
        if (!target) return prev;
        const next: HubChatSession = {
          ...target,
          updatedAt: Date.now(),
          messages: lastMessagesRef.current,
        };
        const updated = upsertSession(prev, next);
        saveSessions(updated);
        return updated;
      });
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [activeId]);

  useEffect(() => {
    saveActiveSessionId(activeId);
  }, [activeId]);

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
  const idleJobRef = useRef<ReturnType<typeof requestIdle> | null>(null);

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
  // Focus trap is suppressed while minimized so the user can interact
  // with the rest of the hub. Esc still routes to `onClose` when the
  // dialog is visible.
  useDialogFocusTrap(!isMinimized, panelRef, { onEscape: onClose });

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

  const sendRef = useRef<
    ((text?: string, fromVoice?: boolean) => Promise<void>) | null
  >(null);
  // Callback ref на `.focus()` ChatInput — використовується після
  // prefill з ChatQuickActions, щоб фокус приходив на input одразу.
  const focusInputRef = useRef<(() => void) | null>(null);

  const maybeSpeak = useCallback((text: string) => {
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
        // Cast tool_calls to ChatAction[] - the API guarantees name+id+input shape
        type ToolCall = {
          id: string;
          name: string;
          input: Record<string, unknown>;
        };
        const toolCalls = data.tool_calls as ToolCall[];
        const handlerResults = await executeActions(
          toolCalls as Parameters<typeof executeActions>[0],
        );
        const toolResults = toolCalls.map((tc, idx) => ({
          tool_use_id: tc.id,
          content: handlerResults[idx]?.result ?? "",
        }));

        // Mutator-handler-и (`create_transaction`, `mark_habit_done`,
        // `log_meal`, `create_habit`, …) повертають `{ undo }` поряд з
        // текстовим результатом. Показуємо стандартний 5-секундний
        // undo-toast для кожного — `showUndoToast` сам повертає taimer
        // (overlap-stack тут прийнятний: один tool-call на 99 % турнів,
        // у дуже рідкісному випадку 2-3 одночасних змін юзер бачить
        // окремий toast на кожну). Read-only handler-и (search,
        // підрахунки, summaries) `undo` не мають — toast не показується.
        for (const hr of handlerResults) {
          if (hr.undo) {
            const undoFn = hr.undo;
            showUndoToast(toast, {
              msg: hr.result,
              onUndo: undoFn,
            });
          }
        }

        const actionsText = toolResults
          .map((r) => `✅ ${r.content}`)
          .join("\n");
        const prefix = `${actionsText}\n\n`;

        // Будуємо action-картки для відомих tool-ів.
        // Якщо tool невідомий — повертається null, лишається лише текст.
        const cards: ChatActionCard[] = toolCalls
          .map((tc, idx) =>
            buildActionCard({
              name: tc.name as string,
              input: tc.input as Record<string, unknown>,
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

  const persistCurrentMessages = useCallback(() => {
    setSessions((prev) => {
      const target = prev.find((s) => s.id === activeId);
      if (!target) return prev;
      const next: HubChatSession = {
        ...target,
        updatedAt: Date.now(),
        messages: lastMessagesRef.current,
      };
      const updated = upsertSession(prev, next);
      saveSessions(updated);
      return updated;
    });
  }, [activeId]);

  // "Нова бесіда" — flush the current one and switch to a fresh
  // session with the standard intro from `normalizeStoredMessages`.
  const handleCreateSession = useCallback(() => {
    stopSpeaking();
    setSpeaking(false);
    persistCurrentMessages();
    const fresh = createSession();
    fresh.title = "Нова бесіда";
    setSessions((prev) => {
      const updated = upsertSession(prev, fresh);
      saveSessions(updated);
      return updated;
    });
    setActiveId(fresh.id);
    setMessages(fresh.messages);
    setHistoryOpen(false);
  }, [persistCurrentMessages]);

  // Backwards-compatible alias used by the "Очистити чат" header
  // button. Now creates a fresh session instead of clobbering the
  // current one — matches the documented multi-session model.
  const clearChat = handleCreateSession;

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === activeId) {
        setHistoryOpen(false);
        return;
      }
      stopSpeaking();
      setSpeaking(false);
      persistCurrentMessages();
      const target = sessions.find((s) => s.id === id);
      if (!target) return;
      setActiveId(target.id);
      setMessages(target.messages);
      setHistoryOpen(false);
    },
    [activeId, sessions, persistCurrentMessages],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      const removed = sessions.find((s) => s.id === id);
      if (!removed) return;
      const remaining = deleteSessionFn(sessions, id);
      let nextActiveId = activeId;
      let nextMessages: typeof messages | null = null;
      if (id === activeId) {
        if (remaining.length > 0) {
          nextActiveId = remaining[0].id;
          nextMessages = remaining[0].messages;
        } else {
          const fresh = createSession();
          remaining.unshift(fresh);
          nextActiveId = fresh.id;
          nextMessages = fresh.messages;
        }
      }
      setSessions(remaining);
      saveSessions(remaining);
      if (nextActiveId !== activeId) setActiveId(nextActiveId);
      if (nextMessages) setMessages(nextMessages);
      showUndoToast(toast, {
        msg: `Видалено бесіду «${removed.title}»`,
        onUndo: () => {
          setSessions((prev) => {
            const updated = upsertSession(prev, removed);
            saveSessions(updated);
            return updated;
          });
        },
      });
    },
    [sessions, activeId, toast],
  );

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
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col safe-area-pt-pb",
        // Visually collapse the dialog while minimized but keep the
        // subtree mounted so messages, draft input, and any in-flight
        // request survive across hide/restore cycles.
        isMinimized && "pointer-events-none opacity-0",
      )}
      aria-hidden={isMinimized}
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
        className="relative mt-auto flex flex-col bg-bg border-t border-line rounded-t-3xl shadow-float max-h-[92dvh] outline-none transition-[margin] duration-150"
        style={kbInsetPx > 0 ? { marginBottom: kbInsetPx } : undefined}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>

        {/* Header — single-row, ChatGPT-style:
            avatar + "Асистент ▾" trigger (popover with status, всі
            бесіди, згорнути, privacy) | + Нова pill | ✕.
            All secondary affordances (info, history list, minimize,
            module subtitle, Mono warning) collapse into the "Деталі"
            popover behind the title. */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 shrink-0 border-b border-line">
          <Popover
            placement="bottom-start"
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            wrapperClassName="min-w-0 flex-1"
            className="!min-w-[280px] p-1.5"
            trigger={
              <span
                aria-label="Деталі асистента"
                className="flex items-center gap-2.5 min-w-0 w-full px-1.5 py-1 -mx-1.5 rounded-xl hover:bg-panelHi transition-colors cursor-pointer select-none"
              >
                <span
                  className={cn(
                    "relative w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0",
                    contextState.status === "building" &&
                      "motion-safe:animate-pulse",
                  )}
                  aria-hidden
                >
                  <Icon name="sparkle" size={16} className="text-brand-500" />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-bg",
                      contextState.status === "ready"
                        ? "bg-brand-500"
                        : contextState.status === "building"
                          ? "bg-warning"
                          : !hasData
                            ? "bg-warning"
                            : "bg-line",
                    )}
                    aria-hidden
                  />
                </span>
                <span className="flex items-center gap-1 min-w-0">
                  <span
                    id="hub-chat-title"
                    className="text-[15px] font-bold text-text leading-snug truncate"
                  >
                    Асистент
                  </span>
                  <Icon
                    name="chevron-down"
                    size={14}
                    className={cn(
                      "text-muted shrink-0 transition-transform duration-150",
                      detailsOpen && "rotate-180",
                    )}
                  />
                </span>
              </span>
            }
          >
            <div
              role="status"
              id="hub-chat-privacy"
              className="space-y-2 px-2 pt-2 pb-1"
            >
              <div className="flex items-center gap-2 text-xs text-text">
                <span
                  className={cn(
                    "inline-block w-2 h-2 rounded-full",
                    contextState.status === "ready"
                      ? "bg-brand-500"
                      : contextState.status === "building"
                        ? "bg-warning motion-safe:animate-pulse"
                        : "bg-line",
                  )}
                  aria-hidden
                />
                <span className="font-semibold">
                  {contextState.status === "building"
                    ? "Готую контекст…"
                    : contextState.status === "ready"
                      ? "Контекст готовий"
                      : "Очікую"}
                </span>
              </div>
              {!hasData && (
                <div className="px-2.5 py-2 bg-warning/10 border border-warning/30 rounded-xl text-2xs text-warning leading-snug">
                  Mono не підключено — фінансовий контекст обмежений.
                </div>
              )}
              <p className="text-2xs text-subtle leading-snug">
                В контексті: {sessionInfo.historyCount} з останніх 10
                повідомлень · ~{Math.round(sessionInfo.chars / 100) / 10}k
                символів.
              </p>
              <p className="text-2xs text-muted leading-snug">
                Контекст (фінанси, тренування, звички, харчування)
                відправляється до AI.
              </p>
            </div>
            <PopoverDivider />
            <PopoverItem
              icon={<Icon name="list" size={14} />}
              onClick={() => {
                setDetailsOpen(false);
                setHistoryOpen(true);
              }}
            >
              Усі бесіди ({sessions.length})
            </PopoverItem>
            {onMinimize && (
              <PopoverItem
                icon={<Icon name="minus" size={14} />}
                onClick={() => {
                  setDetailsOpen(false);
                  onMinimize();
                }}
              >
                Згорнути в FAB
              </PopoverItem>
            )}
          </Popover>
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip content="Почати нову бесіду" placement="bottom-center">
              <button
                type="button"
                onClick={clearChat}
                className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-brand-soft text-brand-strong dark:text-brand border border-brand-soft-border/50 hover:bg-brand-soft-hover transition-colors text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
                aria-label="Нова бесіда"
              >
                <Icon name="plus" size={14} />
                Нова
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
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
              <Tooltip content="Скасувати (Esc)" placement="top-center">
                <button
                  type="button"
                  onClick={cancelInFlight}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-panelHi hover:bg-line/40 text-muted hover:text-text text-2xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
                  aria-label="Скасувати поточний запит"
                >
                  <Icon name="close" size={12} />
                  Скасувати
                </button>
              </Tooltip>
            </div>
          )}
        </div>

        {/*
          Composer block (chips + offline banner + input). Wrapped in a
          subtle panel surface with a top divider so it visually reads
          as a separate "send tray" instead of free-floating controls
          on top of the chat scroll area — same pattern as iMessage /
          ChatGPT / Claude composers.
        */}
        <div className="shrink-0 border-t border-line/60 bg-panel/40 backdrop-blur-sm">
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

        <HubChatHistoryDrawer
          open={historyOpen}
          sessions={sessions}
          activeId={activeId}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
        />
      </div>
    </div>
  );
}

export default HubChat;
