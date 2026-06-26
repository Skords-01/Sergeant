// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { ChatInput } from "./ChatInput";

const chatInputMocks = vi.hoisted(() => ({
  speech: {
    listening: false,
    supported: false,
    toggle: vi.fn(),
    onResult: null as ((text: string) => void) | null,
  },
  stopSpeaking: vi.fn(),
  unlockTTS: vi.fn(),
}));

vi.mock("@shared/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../hooks/useSpeech", () => ({
  useSpeech: (onResult: (text: string) => void) => {
    chatInputMocks.speech.onResult = onResult;
    return {
      listening: chatInputMocks.speech.listening,
      supported: chatInputMocks.speech.supported,
      toggle: chatInputMocks.speech.toggle,
    };
  },
}));

vi.mock("../lib/hubChatSpeech", () => ({
  stopSpeaking: chatInputMocks.stopSpeaking,
  unlockTTS: chatInputMocks.unlockTTS,
}));

function renderChatInput(
  overrides: Partial<React.ComponentProps<typeof ChatInput>> = {},
) {
  const props: React.ComponentProps<typeof ChatInput> = {
    input: "hello",
    setInput: vi.fn(),
    loading: false,
    online: true,
    speaking: false,
    setSpeaking: vi.fn(),
    onSend: vi.fn(),
    onHelp: vi.fn(),
    sendRef: { current: vi.fn() },
    focusInputRef: { current: null },
    ...overrides,
  };
  const view = render(<ChatInput {...props} />);
  return { ...view, props };
}

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatInputMocks.speech.listening = false;
    chatInputMocks.speech.supported = false;
    chatInputMocks.speech.onResult = null;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it("wires text input, help, send, focus ref, and voice result callbacks", () => {
    const focusInputRef = { current: null as (() => void) | null };
    const sendFromVoice = vi.fn();
    const { props } = renderChatInput({
      focusInputRef,
      sendRef: { current: sendFromVoice },
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "next" } });
    expect(props.setInput).toHaveBeenCalledWith("next");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledOnce();

    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(props.onHelp).toHaveBeenCalledOnce();

    focusInputRef.current?.();
    expect(input).toHaveFocus();

    chatInputMocks.speech.onResult?.("  spoken text  ");
    expect(sendFromVoice).toHaveBeenCalledWith("spoken text", true);
  });

  it("disables composer actions while offline", () => {
    const { props } = renderChatInput({ online: false });
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const sendButton = screen.getAllByRole("button").at(-1)!;

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("stops current speech from the speaking control", () => {
    const setSpeaking = vi.fn();
    renderChatInput({ speaking: true, setSpeaking });
    const stopButton = screen.getAllByRole("button")[1]!;

    fireEvent.click(stopButton);
    expect(chatInputMocks.stopSpeaking).toHaveBeenCalledOnce();
    expect(setSpeaking).toHaveBeenCalledWith(false);
  });

  it("unlocks TTS before toggling the microphone", () => {
    chatInputMocks.speech.supported = true;
    renderChatInput();
    const micButton = screen.getAllByRole("button")[1]!;

    fireEvent.click(micButton);
    expect(chatInputMocks.unlockTTS).toHaveBeenCalledOnce();
    expect(chatInputMocks.speech.toggle).toHaveBeenCalledOnce();
  });
});
