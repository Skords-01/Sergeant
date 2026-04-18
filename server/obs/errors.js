/**
 * Operational error hierarchy. Все, що кидається з handler-ів при очікуваних
 * сценаріях (bad input, not found, rate-limit) має бути підкласом `AppError`,
 * тоді `errorHandler` віддасть клієнту стабільний 4xx + `code` і залогує
 * подію на рівні `warn` (не `error`, бо це не баг — це очікувана поведінка).
 *
 * Все інше (undefined is not a function, DB ECONNREFUSED тощо) — це
 * programmer error: 500 + `error` + Sentry.
 */
export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL", cause } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export class ValidationError extends AppError {
  constructor(message, opts = {}) {
    super(message, { status: 400, code: "VALIDATION", ...opts });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", opts = {}) {
    super(message, { status: 401, code: "UNAUTHORIZED", ...opts });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", opts = {}) {
    super(message, { status: 403, code: "FORBIDDEN", ...opts });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", opts = {}) {
    super(message, { status: 404, code: "NOT_FOUND", ...opts });
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded", opts = {}) {
    super(message, { status: 429, code: "RATE_LIMIT", ...opts });
    this.name = "RateLimitError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(message, opts = {}) {
    super(message, { status: 502, code: "EXTERNAL_SERVICE", ...opts });
    this.name = "ExternalServiceError";
  }
}

export function isOperationalError(err) {
  return err instanceof AppError;
}
