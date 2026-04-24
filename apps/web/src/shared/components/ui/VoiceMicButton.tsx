import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { hapticTap } from "@shared/lib/haptic";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult:
    | ((e: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface UseVoiceInputOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onError?: (message: string) => void;
}

export interface UseVoiceInputReturn {
  listening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoiceInput({
  lang = "uk-UA",
  onResult,
  onError,
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(!!SpeechRecognition);
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.("Голосовий ввід не підтримується у цьому браузері.");
      return;
    }
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) onResult?.(transcript);
    };
    rec.onerror = (e) => {
      setListening(false);
      recRef.current = null;
      if (e.error === "not-allowed") {
        onError?.("Немає дозволу на використання мікрофону.");
      } else if (e.error === "no-speech") {
        onError?.("Не вдалося розпізнати мову. Спробуйте ще раз.");
      } else if (e.error !== "aborted") {
        onError?.(`Помилка розпізнавання: ${e.error}`);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
    }
  }, [lang, onResult, onError]);

  const stop = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return { listening, supported, start, stop, toggle };
}

export type VoiceMicButtonSize = "sm" | "md" | "lg";

export interface VoiceMicButtonProps {
  onResult?: (transcript: string) => void;
  onError?: (message: string) => void;
  lang?: string;
  className?: string;
  size?: VoiceMicButtonSize;
  label?: string;
  disabled?: boolean;
}

export function VoiceMicButton({
  onResult,
  onError,
  lang = "uk-UA",
  className,
  size = "md",
  label,
  disabled = false,
}: VoiceMicButtonProps) {
  const { listening, supported, toggle } = useVoiceInput({
    lang,
    onResult,
    onError,
  });

  if (!supported) return null;

  const sizeMap: Record<VoiceMicButtonSize, string> = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };
  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;

  const handleClick = () => {
    hapticTap();
    toggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={listening ? "Зупинити запис" : label || "Голосовий ввід"}
      title={listening ? "Зупинити запис" : label || "Голосовий ввід"}
      className={cn(
        "relative flex items-center justify-center rounded-2xl shrink-0 transition-[background-color,border-color,color,box-shadow,opacity,transform]",
        sizeMap[size] || sizeMap.md,
        listening
          ? "bg-error/15 text-error border border-error/30 motion-safe:animate-pulse"
          : "bg-panelHi text-muted hover:text-text hover:bg-line/40 border border-line",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {listening ? (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}
