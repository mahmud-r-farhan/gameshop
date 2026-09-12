import { describe, expect, it } from 'vitest';
import express, { type Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env.js';
import {
  adminOnly,
  authenticateToken,
  canAccessResource,
  extractBearerToken,
  optionalAuth,
  requireRole,
  superAdminOnly,
  type AuthRequest,
} from '../../../src/middleware/auth.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildApp(middleware: any) {
  const app = express();
  app.use(express.json());
  app.get('/protected', middleware, (req: AuthRequest, res: Response) => {
    res.json({ success: true, user: req.user ?? null });
  });
  // Mirrors the production error handler contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: AuthRequest, res: Response, _next: any) => {
    const error = err as { statusCode?: number; message?: string };
    res.status(error.statusCode ?? 500).json({ success: false, error: error.message });
  });
  return app;
}

const sign = (payload: Record<string, unknown>, secret = env.jwt.secret) =>
  jwt.sign(payload, secret, { expiresIn: '1h' });

const customer = { id: 'user-1', email: 'c@gameshop.test', role: 'USER', type: 'access' };
const admin = { id: 'admin-1', email: 'a@gameshop.test', role: 'ADMIN', type: 'access' };
const superAdmin = { id: 'root-1', email: 'r@gameshop.test', role: 'SUPER_ADMIN', type: 'access' };

describe('extractBearerToken', () => {
  it('accepts the canonical form', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive about the scheme and trims the token', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('BEARER   abc  ')).toBe('abc');
  });

  it('rejects malformed headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('abc')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken(['Bearer a', 'Bearer b'])).toBe('a');
  });
});

describe('authenticateToken', () => {
  const app = buildApp(authenticateToken);

  it('allows a valid access token', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${sign(customer)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 'user-1', role: 'USER' });
  });

  // Regression: a missing token returned 401 but a bad/expired one returned 403,
  // and the frontend interceptor only clears the session on 401 — so an expired
  // token left the UI stuck in a "logged in" state that could never succeed.
  it('returns 401 for a missing token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const expired = jwt.sign(customer, env.jwt.secret, { expiresIn: '-1h' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${sign(customer, 'other-secret-value-that-is-long-enough')}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token minted for another purpose', async () => {
    const refresh = jwt.sign({ id: 'user-1', type: 'refresh' }, env.jwt.refreshSecret, { expiresIn: '1h' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${refresh}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token with a non-access type even under the access secret', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${sign({ id: 'u', email: 'e', role: 'USER', type: 'password_reset' })}`);
    expect(res.status).toBe(401);
  });
});

describe('optionalAuth', () => {
  const app = buildApp(optionalAuth);

  it('passes through when no token is supplied', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('attaches the user when a valid token is supplied', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${sign(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'ADMIN' });
  });

  it('never rejects on a bad token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe('role gates', () => {
  const asUser = (req: request.Request, token: string) => req.set('Authorization', `Bearer ${token}`);

  it('adminOnly admits ADMIN and SUPER_ADMIN', async () => {
    const app = buildApp((req, res, next) => authenticateToken(req, res, () => adminOnly(req, res, next)));
    expect((await asUser(request(app).get('/protected'), sign(admin))).status).toBe(200);
    expect((await asUser(request(app).get('/protected'), sign(superAdmin))).status).toBe(200);
    expect((await asUser(request(app).get('/protected'), sign(customer))).status).toBe(403);
    expect((await request(app).get('/protected')).status).toBe(401);
  });

  it('superAdminOnly admits only SUPER_ADMIN', async () => {
    const app = buildApp((req, res, next) =>
      authenticateToken(req, res, () => superAdminOnly(req, res, next)),
    );
    expect((await asUser(request(app).get('/protected'), sign(superAdmin))).status).toBe(200);
    expect((await asUser(request(app).get('/protected'), sign(admin))).status).toBe(403);
    expect((await asUser(request(app).get('/protected'), sign(customer))).status).toBe(403);
  });

  it('requireRole matches any of the listed roles', async () => {
    const app = buildApp((req, res, next) =>
      authenticateToken(req, res, () => requireRole('ADMIN', 'MODERATOR')(req, res, next)),
    );
    expect((await asUser(request(app).get('/protected'), sign(admin))).status).toBe(200);
    expect((await asUser(request(app).get('/protected'), sign(customer))).status).toBe(403);
  });
});

describe('canAccessResource', () => {
  it('allows the owner', () => {
    expect(canAccessResource({ user: customer } as AuthRequest, 'user-1')).toBe(true);
  });

  it('allows any administrator', () => {
    expect(canAccessResource({ user: admin } as AuthRequest, 'user-1')).toBe(true);
    expect(canAccessResource({ user: superAdmin } as AuthRequest, 'user-1')).toBe(true);
  });

  it('denies an unrelated customer', () => {
    expect(canAccessResource({ user: customer } as AuthRequest, 'user-2')).toBe(false);
  });

  it('denies an unauthenticated caller', () => {
    expect(canAccessResource({} as AuthRequest, 'user-1')).toBe(false);
  });
});
