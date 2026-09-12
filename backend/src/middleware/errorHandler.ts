import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/**
 * Operational error with an HTTP status attached.
 *
 * Anything thrown as an `AppError` is considered *expected*: the message is safe
 * to return to the client and is not logged as a server fault.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, statusCode = 400, options: { code?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = options.code;
    this.details = options.details;
    // Required so `instanceof` keeps working when the class is downlevelled.
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, AppError);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, { code: 'NOT_FOUND' });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, { code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, { code: 'FORBIDDEN' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(message, 409, { code: 'CONFLICT', details });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, { code: 'VALIDATION_ERROR', details });
  }
}

/**
 * Shape of a `PrismaClientKnownRequestError` without importing the client.
 *
 * Duck-typed on purpose: `@prisma/client` may not have been generated yet (for
 * example in a unit-test environment), and the error shape is a stable public
 * contract of the Prisma runtime.
 */
export interface PrismaKnownError extends Error {
  code?: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as Error).name === 'PrismaClientKnownRequestError' &&
    typeof (error as PrismaKnownError).code === 'string'
  );
}

/**
 * Translate Prisma's error codes into meaningful HTTP responses.
 *
 * Without this, a duplicate email during a registration race or a delete of a
 * product still referenced by an order surfaced as an opaque HTTP 500 with a
 * stack trace in development.
 */
export function mapPrismaError(error: PrismaKnownError): AppError {
  const meta = error.meta ?? {};

  switch (error.code) {
    case 'P2002': {
      const target = Array.isArray(meta.target) ? meta.target.join(', ') : String(meta.target ?? 'value');
      return new ConflictError(`A record with this ${target} already exists`, { target });
    }
    case 'P2003':
      return new AppError(
        'This record is still referenced by related data and cannot be removed',
        409,
        { code: 'FOREIGN_KEY_CONSTRAINT' },
      );
    case 'P2006':
      return new ValidationError('Provided value is not valid for this field');
    case 'P2011':
      return new ValidationError('A required value is missing');
    case 'P2012':
      return new ValidationError('A required value is missing');
    case 'P2014':
      return new AppError('This change would break a related record', 409, { code: 'RELATION_VIOLATION' });
    case 'P2025':
      return new NotFoundError(String(meta.modelName ?? 'Resource'));
    default:
      return new AppError('Database request could not be completed', 400, { code: error.code });
  }
}

/**
 * Flatten a Zod error into `{ field, message }` pairs.
 *
 * `unrecognized_keys` (raised by `.strict()` schemas) carries the offending keys
 * in `issue.keys` with an empty `path`; without expanding it the client only sees
 * a `(root)` error and cannot tell which field was rejected — which matters,
 * because that is exactly the mass-assignment guard.
 */
function formatZodError(error: ZodError): Array<{ field: string; message: string }> {
  const formatted: Array<{ field: string; message: string }> = [];

  for (const issue of error.issues) {
    const path = issue.path.join('.');

    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        formatted.push({
          field: path ? `${path}.${key}` : key,
          message: `'${key}' is not an accepted field`,
        });
      }
      continue;
    }

    formatted.push({ field: path || '(root)', message: issue.message });
  }

  return formatted;
}

type ErrorBody = {
  success: false;
  error: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  details?: unknown;
  requestId?: string;
};

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Malformed JSON from the body parser.
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({ success: false, error: 'Request body is not valid JSON' } satisfies ErrorBody);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: formatZodError(err),
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof AppError) {
    const body: ErrorBody = { success: false, error: err.message };
    if (err.code) body.code = err.code;
    if (err.details !== undefined) body.errors = err.details as ErrorBody['errors'];
    res.status(err.statusCode).json(body);
    return;
  }

  if (isPrismaKnownError(err)) {
    const mapped = mapPrismaError(err);
    const body: ErrorBody = { success: false, error: mapped.message };
    if (mapped.code) body.code = mapped.code;
    res.status(mapped.statusCode).json(body);
    return;
  }

  /**
   * Errors raised by `body-parser` (via `http-errors`) carry a numeric `status`
   * and are safe to expose — `expose` is exactly the flag `http-errors` sets to
   * say so. Without this branch an oversized upload returned a 500, which tells
   * the client nothing actionable and pollutes the error budget.
   */
  const httpError = err as { status?: unknown; statusCode?: unknown; expose?: unknown; message?: string };
  const httpStatus = typeof httpError.status === 'number' ? httpError.status : httpError.statusCode;
  if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500 && httpError.expose !== false) {
    const body: ErrorBody = {
      success: false,
      error: httpStatus === 413 ? 'Request body is too large' : httpError.message || 'Bad request',
      code: httpStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
    };
    res.status(httpStatus).json(body);
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  const requestId = (req as Request & { id?: string }).id;

  // Unexpected faults are logged with context; clients get a generic message so
  // internals are never leaked.
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'Unhandled error',
      requestId,
      method: req.method,
      path: req.originalUrl,
      error: error.message,
      stack: env.isProd ? undefined : error.stack,
    }),
  );

  const body: ErrorBody = {
    success: false,
    error: env.isProd ? 'Internal server error' : error.message,
  };
  if (requestId) body.requestId = requestId;

  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  } satisfies ErrorBody);
}
