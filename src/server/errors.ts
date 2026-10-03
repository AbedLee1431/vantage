/** Typed application errors. Server Actions return messages; API routes (Phase 2+) map codes to status. */

export class AppError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in required") {
    super("unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super("forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("not_found", message);
  }
}

export class RateLimitError extends AppError {
  readonly resetAt: Date;
  constructor(resetAt: Date, message = "Too many attempts. Please try again later.") {
    super("rate_limited", message);
    this.resetAt = resetAt;
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string[]>;
  constructor(fieldErrors: Record<string, string[]> = {}, message = "Invalid input") {
    super("validation", message);
    this.fieldErrors = fieldErrors;
  }
}
