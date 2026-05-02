import "dotenv/config";
import { Bot } from "grammy";
import Anthropic from "@anthropic-ai/sdk";
import { runOpenClawCommand } from "./agents/openclaw.js";
import { parseCommand, dispatchToAgent } from "./agents/router.js";
import {
  escapeTelegramMarkdownV2,
  FixedWindowRateLimiter,
  isUserAllowed,
  parseRateLimitPerMinute,
  splitTelegramMessage,
} from "./security.js";

const HELP_TEXT = [
  "*Sergeant Console* - Telegram control surface for ops, marketing, and AI agents",
  "",
  "*/ops* <question> - ask the Ops agent",
  "*/content* <topic> - ask the Marketing agent",
  "",
  "*/status* <scope> - read-only agent/system status",
  "*/plan* <task> - ask n8n to prepare a specialist-agent plan",
  "*/assign* <specialist> <task> - request agent work; risky work needs approval",
  "*/review* <target> - review PR, issue, CI, or workflow state",
  "*/run* <check> - request a controlled check or automation",
  "*/approve* <task-id|command> - approve a risky dispatcher action",
  "*/cancel* <task-id> - cancel a queued dispatcher task",
  "*/logs* <target> - fetch read-only logs or summaries",
  "",
  "Free text still routes to ops or marketing by context.",
  "",
  "_Version: Telegram control plane + n8n dispatcher_",
].join("\n");

function createConsoleBot(botToken: string, anthropicKey: string): Bot {
  const bot = new Bot(botToken);
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const limiter = new FixedWindowRateLimiter(
    parseRateLimitPerMinute(process.env.CONSOLE_RATE_LIMIT_PER_MIN),
  );
  const checkAuth = (userId: number | undefined) =>
    isUserAllowed(userId, process.env);

  bot.command("start", async (ctx) => {
    if (!checkAuth(ctx.from?.id)) {
      await ctx.reply("Access denied.");
      return;
    }
    await ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
  });

  bot.command("help", async (ctx) => {
    if (!checkAuth(ctx.from?.id)) return;
    await ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
  });

  bot.on("message:text", async (ctx) => {
    if (!checkAuth(ctx.from?.id)) {
      await ctx.reply("Access denied.");
      return;
    }
    const rateLimitKey = String(ctx.from?.id ?? ctx.chat.id);
    if (!limiter.allow(rateLimitKey)) {
      await ctx.reply("Rate limit exceeded. Try again in a minute.");
      return;
    }

    const text = ctx.message.text;
    const { agent, query } = parseCommand(text);

    await ctx.replyWithChatAction("typing");

    try {
      const reply = await dispatchToAgent(anthropic, agent, query, {
        telegramUserId: ctx.from?.id ?? 0,
        telegramChatId: ctx.chat.id,
        messageId: ctx.message.message_id,
      });
      const safeReply = escapeTelegramMarkdownV2(reply);
      for (const chunk of splitTelegramMessage(safeReply)) {
        await ctx.reply(chunk, { parse_mode: "MarkdownV2" });
      }
    } catch (err) {
      console.error("Agent error:", err);
      await ctx.reply("Agent error. Try again.");
    }
  });

  bot.catch((err) => {
    console.error("Console bot error:", err.error, {
      updateId: err.ctx?.update?.update_id,
    });
  });

  return bot;
}

function createOpenClawBot(botToken: string): Bot {
  const bot = new Bot(botToken);
  const limiter = new FixedWindowRateLimiter(
    parseRateLimitPerMinute(process.env.CONSOLE_RATE_LIMIT_PER_MIN),
  );

  bot.command("start", async (ctx) => {
    const reply = await runOpenClawCommand({
      text: "status openclaw",
      chatType: ctx.chat?.type ?? "unknown",
      telegramUserId: ctx.from?.id,
      telegramChatId: ctx.chat.id,
      messageId: ctx.message?.message_id ?? 0,
    });
    await ctx.reply(escapeTelegramMarkdownV2(reply), {
      parse_mode: "MarkdownV2",
    });
  });

  bot.on("message:text", async (ctx) => {
    const rateLimitKey = `openclaw:${ctx.from?.id ?? ctx.chat.id}`;
    if (!limiter.allow(rateLimitKey)) {
      await ctx.reply("Rate limit exceeded. Try again in a minute.");
      return;
    }

    await ctx.replyWithChatAction("typing");

    try {
      const reply = await runOpenClawCommand({
        text: ctx.message.text,
        chatType: ctx.chat.type,
        telegramUserId: ctx.from?.id,
        telegramChatId: ctx.chat.id,
        messageId: ctx.message.message_id,
      });
      const safeReply = escapeTelegramMarkdownV2(reply);
      for (const chunk of splitTelegramMessage(safeReply)) {
        await ctx.reply(chunk, { parse_mode: "MarkdownV2" });
      }
    } catch (err) {
      console.error("OpenClaw error:", err);
      await ctx.reply("OpenClaw error. Try again.");
    }
  });

  bot.catch((err) => {
    console.error("OpenClaw bot error:", err.error, {
      updateId: err.ctx?.update?.update_id,
    });
  });

  return bot;
}

async function main() {
  const botToken = process.env.CONSOLE_BOT_TOKEN;
  const openClawToken = process.env.OPENCLAW_BOT_TOKEN;
  if (!botToken && !openClawToken) {
    console.error("CONSOLE_BOT_TOKEN or OPENCLAW_BOT_TOKEN is required");
    process.exit(1);
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (botToken && !anthropicKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  const bots: Array<Promise<void>> = [];

  if (botToken && anthropicKey) {
    console.log("Sergeant Console starting…");
    bots.push(createConsoleBot(botToken, anthropicKey).start());
  }
  if (openClawToken) {
    console.log("OpenClaw founder bot starting…");
    bots.push(createOpenClawBot(openClawToken).start());
  }
  await Promise.all(bots);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
