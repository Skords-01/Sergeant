import { createHash } from "node:crypto";

import { logger } from "../obs/logger.js";

function isDeployedProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_SERVICE_NAME)
  );
}

function emailFingerprint(email: string): string {
  return createHash("sha256")
    .update(email.toLowerCase(), "utf8")
    .digest("hex")
    .slice(0, 12);
}

export type AuthMailKind = "password_reset" | "email_verification";

/**
 * Транзакційні листи Better Auth (reset / verify) через Resend HTTP API.
 * Без `RESEND_API_KEY` у dev логуємо факт (без URL/token); у prod — warn без токена.
 */
export function queueAuthTransactionalEmail(args: {
  kind: AuthMailKind;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): void {
  void dispatchAuthTransactionalEmail(args).catch((err: unknown) => {
    logger.error({
      msg: "auth_transactional_email_failed",
      kind: args.kind,
      emailHash: emailFingerprint(args.to),
      err: err instanceof Error ? err.message : String(err),
    });
  });
}

async function dispatchAuthTransactionalEmail(args: {
  kind: AuthMailKind;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (isDeployedProduction()) {
      logger.warn({
        msg: "auth_transactional_email_skipped_no_provider",
        kind: args.kind,
        emailHash: emailFingerprint(args.to),
      });
    } else {
      logger.info({
        msg: "auth_transactional_email_skipped_dev_no_resend",
        kind: args.kind,
        emailHash: emailFingerprint(args.to),
      });
    }
    return;
  }

  const from =
    process.env.RESEND_FROM?.trim() || "Sergeant <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 500)}`);
  }

  logger.info({
    msg: "auth_transactional_email_sent",
    kind: args.kind,
    emailHash: emailFingerprint(args.to),
  });
}
