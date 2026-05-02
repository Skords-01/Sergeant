import { describe, expect, it, vi } from "vitest";
import {
  createOpenClawTask,
  isOpenClawFounderAllowed,
  isOpenClawPrivateChat,
  runOpenClawCommand,
} from "./openclaw.js";

describe("OpenClaw Telegram surface", () => {
  it("fails closed when founder Telegram id is not configured", () => {
    expect(
      isOpenClawFounderAllowed(123, {
        OPENCLAW_FOUNDER_TG_USER_ID: "",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("allows only the configured founder Telegram id", () => {
    const env = { OPENCLAW_FOUNDER_TG_USER_ID: "123" };

    expect(isOpenClawFounderAllowed(123, env)).toBe(true);
    expect(isOpenClawFounderAllowed(999, env)).toBe(false);
  });

  it("runs only in private Telegram chats", () => {
    expect(isOpenClawPrivateChat("private")).toBe(true);
    expect(isOpenClawPrivateChat("supergroup")).toBe(false);
    expect(isOpenClawPrivateChat("group")).toBe(false);
  });

  it("creates an OpenClaw dispatcher payload from natural language", () => {
    expect(
      createOpenClawTask({
        text: "перевір CI і дай план",
        telegramUserId: 123,
        telegramChatId: 123,
        messageId: 88,
      }),
    ).toMatchObject({
      source: "openclaw",
      commandText: "review перевір CI і дай план",
      action: "review",
      specialist: "qa-release",
      mode: "read-only",
      requiresApproval: false,
      telegram: {
        userId: 123,
        chatId: 123,
        messageId: 88,
      },
    });
  });

  it("asks for approval before mutating OpenClaw tasks", async () => {
    const dispatch = vi.fn();

    const reply = await runOpenClawCommand(
      {
        text: "задеплой production",
        chatType: "private",
        telegramUserId: 123,
        telegramChatId: 123,
        messageId: 89,
      },
      {
        env: { OPENCLAW_FOUNDER_TG_USER_ID: "123" },
        dispatch,
      },
    );

    expect(dispatch).not.toHaveBeenCalled();
    expect(reply).toContain("Approval required.");
    expect(reply).toContain("Source: openclaw");
    expect(reply).toContain("/approve run задеплой production");
  });

  it("dispatches approved OpenClaw tasks to n8n", async () => {
    const dispatch = vi.fn().mockResolvedValue("accepted");

    await expect(
      runOpenClawCommand(
        {
          text: "/approve run задеплой production",
          chatType: "private",
          telegramUserId: 123,
          telegramChatId: 123,
          messageId: 90,
        },
        {
          env: { OPENCLAW_FOUNDER_TG_USER_ID: "123" },
          dispatch,
        },
      ),
    ).resolves.toBe("accepted");

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "openclaw",
        action: "approve",
        commandText: "approve run задеплой production",
      }),
      expect.any(Object),
    );
  });

  it("blocks unauthorized users and group chats before dispatch", async () => {
    const dispatch = vi.fn();

    await expect(
      runOpenClawCommand(
        {
          text: "status agents",
          chatType: "private",
          telegramUserId: 999,
          telegramChatId: 999,
          messageId: 91,
        },
        {
          env: { OPENCLAW_FOUNDER_TG_USER_ID: "123" },
          dispatch,
        },
      ),
    ).resolves.toBe("Access denied.");

    await expect(
      runOpenClawCommand(
        {
          text: "status agents",
          chatType: "supergroup",
          telegramUserId: 123,
          telegramChatId: -100,
          messageId: 92,
        },
        {
          env: { OPENCLAW_FOUNDER_TG_USER_ID: "123" },
          dispatch,
        },
      ),
    ).resolves.toBe("OpenClaw is available only in a private founder DM.");

    expect(dispatch).not.toHaveBeenCalled();
  });
});
