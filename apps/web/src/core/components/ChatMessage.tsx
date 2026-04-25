import { cn } from "@shared/lib/cn";
import { AssistantMessageBody } from "./AssistantMessageBody";
import { speak } from "../lib/hubChatSpeech";
import type { ChatMessage as ChatMessageData } from "../lib/hubChatUtils";

interface ChatMessageProps {
  message: ChatMessageData;
  onSpeak?: () => void;
}

export function ChatMessage({ message, onSpeak }: ChatMessageProps) {
  const { role, text } = message;
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isAssistant ? "flex-row" : "flex-row-reverse",
      )}
    >
      {isAssistant && (
        <span className="text-lg shrink-0 mb-0.5 leading-none">🤖</span>
      )}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isAssistant
            ? "bg-panel border border-line text-text rounded-bl-sm whitespace-normal"
            : "bg-primary text-bg rounded-br-sm whitespace-pre-wrap",
        )}
      >
        {isAssistant ? <AssistantMessageBody text={text} /> : text}
        {isAssistant && text && text.length > 3 && (
          <button
            type="button"
            onClick={() => {
              speak(text);
              onSpeak?.();
            }}
            className="mt-1.5 flex items-center gap-1 text-xs text-subtle hover:text-text transition-colors"
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
  );
}

export function TypingIndicator() {
  return (
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
  );
}
