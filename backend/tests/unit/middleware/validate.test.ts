import { describe, expect, it } from 'vitest';
import express, { type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { asyncHandler, validate } from '../../../src/middleware/validate.js';
import { errorHandler } from '../../../src/middleware/errorHandler.js';

function buildApp() {
  const app = express();
  app.use(express.json());

  app.post(
    '/body',
    validate({ body: z.object({ name: z.string().min(2), age: z.coerce.number().int() }).strict() }),
    (req, res: Response) => res.json({ received: req.body }),
  );

  app.get(
    '/query',
    validate({
      query: z.object({
        page: z.coerce.number().int().min(1).catch(1),
        limit: z.coerce.number().int().min(1).max(100).catch(20),
        search: z.string().trim().optional(),
      }),
    }),
    (req, res: Response) => res.json({ received: req.query }),
  );

  app.get(
    '/params/:id',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    (req, res: Response) => res.json({ received: req.params }),
  );

  app.get(
    '/async',
    asyncHandler(async (_req, _res: Response) => {
      await Promise.resolve();
      throw new Error('async explosion');
    }),
  );

  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('validate({ body })', () => {
  it('passes a valid body through, coerced and trimmed', async () => {
    const res = await request(app).post('/body').send({ name: 'Ada', age: '36' });
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ name: 'Ada', age: 36 });
  });

  it('returns a 400 with field-level messages', async () => {
    const res = await request(app).post('/body').send({ name: 'A', age: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['age', 'name']);
  });

  // Regression: unknown keys were forwarded straight into Prisma (mass assignment).
  it('rejects unexpected keys when the schema is strict', async () => {
    const res = await request(app).post('/body').send({ name: 'Ada', age: 36, role: 'SUPER_ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('role');
  });

  it('validates nested structures the old rule engine could not express', async () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
    });
    expect(schema.safeParse({ items: [] }).success).toBe(false);
    expect(schema.safeParse({ items: [{ id: 'x', quantity: -1 }] }).success).toBe(false);
    expect(
      schema.safeParse({ items: [{ id: '6f1e2c3d-0000-4000-8000-000000000000', quantity: 2 }] }).success,
    ).toBe(true);
  });
});

describe('validate({ query })', () => {
  it('coerces query strings to numbers', async () => {
    const res = await request(app).get('/query?page=3&limit=10&search=%20pubg%20');
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ page: 3, limit: 10, search: 'pubg' });
  });

  // Regression: `?page=abc` produced `NaN`, which Prisma rejected with a 500.
  it('falls back to defaults for unparsable values instead of 500ing', async () => {
    const res = await request(app).get('/query?page=abc&limit=-4');
    expect(res.status).toBe(200);
    expect(res.body.received).toMatchObject({ page: 1, limit: 20 });
  });

  it('works when no query parameters are supplied at all', async () => {
    const res = await request(app).get('/query');
    expect(res.status).toBe(200);
    expect(res.body.received).toMatchObject({ page: 1, limit: 20 });
  });
});

describe('validate({ params })', () => {
  it('accepts a valid uuid', async () => {
    const id = '6f1e2c3d-0000-4000-8000-000000000000';
    const res = await request(app).get(`/params/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.received.id).toBe(id);
  });

  it('rejects a malformed id', async () => {
    const res = await request(app).get('/params/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('id');
  });
});

describe('asyncHandler', () => {
  // Regression: Express 4 does not catch async rejections, so a missing
  // try/catch hung the request until the client timed out.
  it('forwards a rejected promise to the error handler', async () => {
    const res = await request(app).get('/async');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
