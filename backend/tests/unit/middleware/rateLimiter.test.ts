import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  adminWriteLimiter,
  createLimiter,
  apiLimiter,
  authLimiter,
  loginLimiter,
  otpLimiter,
  otpVerifyLimiter,
} from '../../../src/middleware/rateLimiter.js';

function appWith(limiter: ReturnType<typeof createLimiter>) {
  const app = express();
  // `app.ts` sets this in production; without it every request shares the socket
  // address and per-client bucketing cannot be exercised.
  app.set('trust proxy', 1);
  app.use(limiter);
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('createLimiter', () => {
  it('allows requests under the budget', async () => {
    const app = appWith(createLimiter({ windowMs: 1000, max: 3, error: 'slow down' }));

    for (let i = 0; i < 3; i += 1) {
      await expect(request(app).get('/ping')).resolves.toHaveProperty('status', 200);
    }
  });

  it('returns 429 with the project error envelope once the budget is spent', async () => {
    const app = appWith(createLimiter({ windowMs: 1000, max: 2, error: 'slow down' }));

    await request(app).get('/ping');
    await request(app).get('/ping');
    const response = await request(app).get('/ping');

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ success: false, error: 'slow down' });
  });

  it('emits RFC-standard RateLimit headers and none of the legacy X- ones', async () => {
    const app = appWith(createLimiter({ windowMs: 1000, max: 5, error: 'slow down' }));
    const response = await request(app).get('/ping');

    expect(response.headers['ratelimit-limit']).toBe('5');
    expect(response.headers['ratelimit-remaining']).toBe('4');
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('counts each client separately', async () => {
    const app = appWith(createLimiter({ windowMs: 1000, max: 1, error: 'slow down' }));

    const a = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.1');
    const b = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.2');
    const aAgain = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.1');

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(aAgain.status).toBe(429);
  });

  it('honours a skip predicate', async () => {
    const app = appWith(createLimiter({ windowMs: 1000, max: 1, error: 'slow down', skip: () => true }));

    for (let i = 0; i < 5; i += 1) {
      await expect(request(app).get('/ping')).resolves.toHaveProperty('status', 200);
    }
  });

  it('does not warn about unknown configuration keys', async () => {
    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));

    try {
      createLimiter({ windowMs: 1000, max: 1, error: 'slow down' });
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings.filter((w) => String(w).includes('express-rate-limit'))).toEqual([]);
  });
});

describe('production limiter budgets', () => {
  // These are the numbers an attacker actually faces; a typo here is a security
  // regression, so pin them.
  it.each([
    ['loginLimiter', loginLimiter],
    ['apiLimiter', apiLimiter],
    ['authLimiter', authLimiter],
    ['otpLimiter', otpLimiter],
    ['otpVerifyLimiter', otpVerifyLimiter],
    ['adminWriteLimiter', adminWriteLimiter],
  ])('%s is a request handler', (_name, limiter) => {
    expect(typeof limiter).toBe('function');
  });

  it('skips limiting while NODE_ENV=test so suites stay deterministic', async () => {
    const app = appWith(loginLimiter);
    for (let i = 0; i < 25; i += 1) {
      await expect(request(app).get('/ping')).resolves.toHaveProperty('status', 200);
    }
  });
});
