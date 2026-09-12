import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import express, { type Response } from 'express';
import request from 'supertest';
import {
  AppError,
  ConflictError,
  errorHandler,
  ForbiddenError,
  mapPrismaError,
  NotFoundError,
  notFoundHandler,
  UnauthorizedError,
  ValidationError,
} from '../../../src/middleware/errorHandler.js';
import { prismaError } from '../../helpers/prisma-mock.js';
import type { PrismaKnownError } from '../../../src/middleware/errorHandler.js';
import { z } from 'zod';

/**
 * Unexpected faults are logged; silence them globally so the test output stays
 * readable, then assert against the captured calls where it matters.
 */
let errorLog: MockInstance;

beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  errorLog.mockRestore();
});

function lastLoggedError(): Record<string, unknown> {
  return JSON.parse(errorLog.mock.calls.at(-1)?.[0] as string);
}

function buildApp(thrower: () => unknown) {
  const app = express();
  app.use(express.json());
  app.get('/boom', (_req, _res, next) => {
    try {
      throw thrower();
    } catch (error) {
      next(error);
    }
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('AppError', () => {
  it('defaults to 400 and is operational', () => {
    const error = new AppError('nope');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.message).toBe('nope');
  });

  it('is recognised by instanceof after subclassing', () => {
    expect(new NotFoundError('Thing')).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
  });

  it('has purpose-built subclasses with the right statuses', () => {
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new ValidationError().statusCode).toBe(400);
  });

  it('captures a stack trace', () => {
    expect(new AppError('x').stack).toContain('AppError');
  });
});

describe('errorHandler HTTP contract', () => {
  it('passes an AppError message and status through', async () => {
    const res = await request(buildApp(() => new AppError('Out of stock', 409))).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'Out of stock' });
  });

  it('includes the error code when present', async () => {
    const res = await request(buildApp(() => new NotFoundError('Order'))).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND', error: 'Order not found' });
  });

  it('converts a ZodError into a field-level 400', async () => {
    const schema = z.object({ email: z.string().email() });
    const error = schema.safeParse({ email: 'nope' });
    const res = await request(buildApp(() => {
      throw error.error ?? new Error('expected a ZodError');
    })).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toEqual([{ field: 'email', message: expect.stringContaining('email') }]);
  });

  it('maps a Prisma unique violation to 409 without leaking internals', async () => {
    const res = await request(buildApp(() => prismaError('P2002', { target: ['users', 'email'] }))).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
    expect(res.body.error).not.toMatch(/Prisma/);
  });

  it('maps a Prisma "record not found" to 404', async () => {
    const res = await request(buildApp(() => prismaError('P2025', { modelName: 'Product' }))).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Product not found');
  });

  it('maps a foreign-key violation to an actionable 409', async () => {
    const res = await request(buildApp(() => prismaError('P2003'))).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/referenced by related data/);
  });

  // Regression: malformed JSON from the body parser was an unhandled SyntaxError
  // and returned a 500.
  it('returns 400 for malformed JSON', async () => {
    const app = express();
    app.use(express.json());
    app.post('/x', (_req, res: Response) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).post('/x').set('Content-Type', 'application/json').send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid JSON/);
  });

  it('logs unexpected errors as structured JSON with request context', async () => {
    const res = await request(buildApp(() => new Error('kaboom'))).get('/boom');

    expect(res.status).toBe(500);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(lastLoggedError()).toMatchObject({
      level: 'error',
      msg: 'Unhandled error',
      method: 'GET',
      path: '/boom',
      error: 'kaboom',
    });
  });

  it('does not log expected operational errors as server faults', async () => {
    await request(buildApp(() => new NotFoundError('Order'))).get('/boom');
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('coerces a non-Error throwable', async () => {
    const res = await request(buildApp(() => 'just a string')).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('just a string');
  });

  it('returns a 404 body for unknown routes', async () => {
    const res = await request(buildApp(() => new AppError('x'))).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'ROUTE_NOT_FOUND' });
    expect(res.body.error).toContain('GET /does-not-exist');
  });
});

describe('mapPrismaError', () => {
  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2006', 400],
    ['P2011', 400],
    ['P2012', 400],
    ['P2014', 409],
    ['P2025', 404],
    ['P9999', 400],
  ])('maps %s to HTTP %i', (code, status) => {
    expect(mapPrismaError(prismaError(code) as PrismaKnownError).statusCode).toBe(status);
  });

  it('ignores errors that are not Prisma known-request errors', async () => {
    const res = await request(buildApp(() => {
      const error = new Error('code P2002 but wrong name');
      (error as Error & { code: string }).code = 'P2002';
      return error;
    })).get('/boom');
    expect(res.status).toBe(500);
  });
});
