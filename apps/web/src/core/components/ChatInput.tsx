import { cn } from "@shared/lib/cn";
import { stopSpeaking, unlockTTS } from "../lib/hubChatSpeech.js";
import { useSpeech } from "../hooks/useSpeech.js";
import {
  useRef,
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

interface ChatInputProps {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  loading: boolean;
  online: boolean;
  speaking: boolean;
  setSpeaking: Dispatch<SetStateAction<boolean>>;
  onSend: () => void;
  sendRef: MutableRefObject<
    ((text?: string, fromVoice?: boolean) => void) | null
  >;
}

export function ChatInput({
  input,
  setInput,
  loading,
  online,
  speaking,
  setSpeaking,
  onSend,
  sendRef,
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const {
    listening,
    toggle: rawToggleMic,
    supported: speechSupported,
  } = useSpeech((text) => {
    if (text.trim()) {
      sendRef.current?.(text.trim(), true);
    }
  });

  const toggleMic = useCallback(() => {
    unlockTTS();
    rawToggleMic();
  }, [rawToggleMic]);

  return (
    <div className="flex gap-2 px-4 pt-2 pb-4 shrink-0">
      <input
        ref={inputRef}
        className="input-focus-finyk flex-1 bg-panel border border-line rounded-2xl px-4 py-3 text-sm text-text placeholder:text-subtle disabled:opacity-50"
        placeholder={
          online
            ? "Запитай або попроси змінити щось…"
            : "Немає зʼєднання — асистент офлайн"
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) =>
          e.key === "Enter" && !e.shiftKey && online && onSend()
        }
        disabled={!online}
        aria-label="Повідомлення асистенту"
      />
      {speaking ? (
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            setSpeaking(false);
          }}
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all border bg-warning/15 border-warning text-warning motion-safe:animate-pulse"
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
              ? "bg-danger text-white border-danger motion-safe:animate-pulse"
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
        onClick={onSend}
        disabled={loading || !input.trim() || !online}
        className="w-11 h-11 rounded-full bg-primary text-bg flex items-center justify-center shrink-0 hover:brightness-110 transition-all disabled:opacity-40"
        aria-label={online ? "Надіслати" : "Надсилання недоступне офлайн"}
        title={online ? "Надіслати" : "Немає інтернету — асистент офлайн"}
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
  );
}
