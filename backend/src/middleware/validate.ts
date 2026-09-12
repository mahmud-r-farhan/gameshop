import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from './errorHandler.js';

/**
 * Zod-based request validation.
 *
 * Replaces the previous hand-rolled rule engine, which could only validate flat
 * top-level body fields. Nested payloads — notably `POST /orders` with its
 * `items[]` array — were passed straight through to the service layer, so
 * `items: undefined` crashed the handler and `quantity: -5` produced a negative
 * order total.
 *
 * Parsed (and therefore coerced/trimmed/defaulted) values are written back onto
 * the request so downstream handlers never see raw strings.
 */

export type ValidationSource = 'body' | 'query' | 'params';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const sources: ValidationSource[] = ['params', 'query', 'body'];

      for (const source of sources) {
        const schema = schemas[source];
        if (!schema) continue;

        const input = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
        const result = schema.parse(input ?? {});

        if (source === 'body') {
          req.body = result;
        } else if (source === 'query') {
          // `req.query` is a getter on Express 5 / frozen in some setups.
          Object.defineProperty(req, 'query', {
            value: result,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } else {
          Object.assign(req.params, result);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Convenience: validate only the request body. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return validate({ body: schema });
}

/** Convenience: validate only query parameters. */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return validate({ query: schema });
}

/**
 * Wrap an async handler so a rejected promise reaches `errorHandler`.
 *
 * Express 4 does not catch async rejections; every route previously needed its
 * own `try/catch`, and a single missing one turned into an unhandled rejection
 * that hung the request until the client timed out.
 */
export function asyncHandler<
  T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(handler: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

/** Throw an `AppError` — useful inside `asyncHandler` bodies. */
export function fail(message: string, statusCode = 400, code?: string): never {
  throw new AppError(message, statusCode, { code });
}

export type InferSchema<T extends ZodTypeAny> = z.infer<T>;
