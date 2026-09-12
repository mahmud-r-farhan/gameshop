import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, UUID, USER, asUser } = await import('./helpers.js');
const { generateRefreshToken } = await import('../../src/utils/tokens.js');

/**
 * HTTP-level coverage for `/api/v1/auth`.
 *
 * The unit tests already prove `AuthService` behaves; these prove the *route*
 * behaves — that validation runs before the handler, that the right status code
 * and envelope come back, and that the account-takeover regressions cannot be
 * reintroduced by editing a route file alone.
 */

const PASSWORD = 'Password123';
const EMAIL = 'buyer@example.com';

/** Precomputed once — bcrypt at cost 10 dominates the suite otherwise. */
let passwordHash: string;

beforeEach(async () => {
  resetDb();
  passwordHash ??= await bcrypt.hash(PASSWORD, 10);
});

function storedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID.user,
    email: EMAIL,
    phone: '01712345678',
    passwordHash,
    fullName: 'Test Buyer',
    role: 'USER',
    isActive: true,
    emailVerified: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('POST /auth/register', () => {
  const payload = { email: EMAIL, password: PASSWORD, fullName: 'Test Buyer', phone: '01712345678' };

  it('creates the account and returns a token pair', async () => {
    model('user').create.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/register').send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true });
    expect(response.body.data.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(response.body.data.refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('never returns the password hash or other internals', async () => {
    model('user').create.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/register').send(payload);
    const user = response.body.data.user;

    expect(user).not.toHaveProperty('passwordHash');
    expect(user).toMatchObject({ id: UUID.user, email: EMAIL, role: 'USER' });
  });

  it('normalises the email to lower case before persisting', async () => {
    model('user').create.mockResolvedValue(storedUser());

    await api().post('/api/v1/auth/register').send({ ...payload, email: 'Buyer@Example.COM' });
    expect(model('user').create.mock.calls[0][0].data.email).toBe('buyer@example.com');
  });

  it('rejects a missing password with a 400 and field-level detail', async () => {
    const { password: _omit, ...rest } = payload;
    const response = await api().post('/api/v1/auth/register').send(rest);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
    expect(response.body.errors.map((e: { field: string }) => e.field)).toContain('password');
  });

  it('rejects a weak password', async () => {
    const response = await api().post('/api/v1/auth/register').send({ ...payload, password: 'abc' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].message).toMatch(/at least 8 characters/);
  });

  it('rejects a malformed Bangladeshi phone number', async () => {
    const response = await api().post('/api/v1/auth/register').send({ ...payload, phone: '555-0100' });
    expect(response.status).toBe(400);
    expect(response.body.errors.map((e: { field: string }) => e.field)).toContain('phone');
  });

  it('treats an empty phone input from an HTML form as "not provided"', async () => {
    model('user').create.mockResolvedValue(storedUser({ phone: null }));

    const response = await api().post('/api/v1/auth/register').send({ ...payload, phone: '' });
    expect(response.status).toBe(201);
  });

  // Regression: a signup race used to leak a raw P2002 as an HTTP 500.
  it('maps a duplicate-email race to 409', async () => {
    const { prismaError } = await import('../helpers/prisma-mock.js');
    model('user').create.mockRejectedValue(prismaError('P2002', { target: ['email'] }));

    const response = await api().post('/api/v1/auth/register').send(payload);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ success: false, code: 'CONFLICT' });
  });

  it('refuses to let a caller choose their own role', async () => {
    model('user').create.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/register').send({ ...payload, role: 'ADMIN' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('role');
  });
});

describe('POST /auth/login', () => {
  it('returns a token pair for valid credentials', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());
    model('user').update.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('is case-insensitive about the email address', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());
    model('user').update.mockResolvedValue(storedUser());

    await api().post('/api/v1/auth/login').send({ email: 'BUYER@example.com', password: PASSWORD });
    expect(model('user').findUnique.mock.calls[0][0].where.email).toBe('buyer@example.com');
  });

  it('returns 401 for a wrong password without saying which half was wrong', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'WrongPass1' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('returns the same 401 for an unknown email', async () => {
    model('user').findUnique.mockResolvedValue(null);

    const response = await api().post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('returns 403 (not 401) for a disabled account, so the client can explain it', async () => {
    model('user').findUnique.mockResolvedValue(storedUser({ isActive: false }));

    const response = await api().post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/disabled/i);
  });

  it('still runs a bcrypt comparison for an unknown email (timing equalisation)', async () => {
    model('user').findUnique.mockResolvedValue(null);

    const started = process.hrtime.bigint();
    await api().post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    // A bcrypt compare at cost 10 is tens of milliseconds; a skipped one is ~0.
    expect(elapsedMs).toBeGreaterThan(5);
  });

  it('validates the email format before touching the database', async () => {
    const response = await api().post('/api/v1/auth/login').send({ email: 'not-an-email', password: 'x' });

    expect(response.status).toBe(400);
    expect(model('user').findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /auth/refresh', () => {
  /**
   * Regression: `login` and `register` always returned a `refreshToken` and the
   * backend always had `JWT_REFRESH_SECRET`, but there was no endpoint to use
   * it — every session died after 24h.
   */
  it('exchanges a refresh token for a new token pair', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: generateRefreshToken(UUID.user) });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.refreshToken).toBeTruthy();
  });

  it('refuses an access token presented as a refresh token', async () => {
    const response = await api()
      .post('/api/v1/auth/refresh')
      .set(asUser())
      .send({ refreshToken: asUser().Authorization.replace('Bearer ', '') });

    expect(response.status).toBe(401);
  });

  it('refuses garbage', async () => {
    const response = await api().post('/api/v1/auth/refresh').send({ refreshToken: 'not-a-jwt-at-all-nope' });
    expect(response.status).toBe(401);
  });

  it('400s when the field is missing entirely', async () => {
    const response = await api().post('/api/v1/auth/refresh').send({});
    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('refreshToken');
  });

  it('refuses to refresh a deleted account', async () => {
    model('user').findUnique.mockResolvedValue(null);

    const response = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: generateRefreshToken(UUID.user) });

    expect(response.status).toBe(401);
  });

  it('refuses to refresh a disabled account', async () => {
    model('user').findUnique.mockResolvedValue(storedUser({ isActive: false }));

    const response = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: generateRefreshToken(UUID.user) });

    expect(response.status).toBe(403);
  });
});

describe('POST /auth/reset-password', () => {
  const newPassword = 'BrandNewPass1';

  /**
   * THE critical regression. This endpoint used to accept `{ email, password }`
   * with no token, so any anonymous caller could overwrite any account's
   * password. It must stay locked down at the *route* level, not just in the
   * service.
   */
  it('rejects a request with no reset token', async () => {
    const response = await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: EMAIL, password: newPassword });

    expect(response.status).toBe(400);
    expect(response.body.errors.map((e: { field: string }) => e.field)).toContain('token');
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('rejects a bogus token', async () => {
    const response = await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: EMAIL, password: newPassword, token: 'x'.repeat(40) });

    expect(response.status).toBe(401);
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('rejects an access token replayed as a reset token', async () => {
    const response = await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: EMAIL, password: newPassword, token: asUser().Authorization.replace('Bearer ', '') });

    expect(response.status).toBe(401);
  });

  it('rejects a refresh token replayed as a reset token', async () => {
    const response = await api()
      .post('/api/v1/auth/reset-password')
      .send({
        email: EMAIL,
        password: newPassword,
        token: generateRefreshToken(UUID.user),
      });

    expect(response.status).toBe(401);
  });
});

describe('POST /auth/forgot-password', () => {
  it('answers identically for a known address', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/forgot-password').send({ email: EMAIL });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/if the email exists/i);
  });

  it('answers identically for an unknown address (no user enumeration)', async () => {
    model('user').findUnique.mockResolvedValue(null);

    const known = await api().post('/api/v1/auth/forgot-password').send({ email: EMAIL });
    const unknown = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('never echoes an OTP in the response', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/forgot-password').send({ email: EMAIL });
    expect(JSON.stringify(response.body)).not.toMatch(/"otp"/);
    expect(JSON.stringify(response.body)).not.toMatch(/\b\d{6}\b/);
  });

  it('400s on a malformed address', async () => {
    const response = await api().post('/api/v1/auth/forgot-password').send({ email: 'nope' });
    expect(response.status).toBe(400);
  });
});

describe('POST /auth/verify-otp', () => {
  it('rejects a non-numeric OTP', async () => {
    const response = await api().post('/api/v1/auth/verify-otp').send({ email: EMAIL, otp: 'abcdef' });
    expect(response.status).toBe(400);
  });

  it('rejects an OTP of the wrong length', async () => {
    const response = await api().post('/api/v1/auth/verify-otp').send({ email: EMAIL, otp: '12345' });
    expect(response.status).toBe(400);
  });

  // 400 (not 401) on purpose: the frontend's axios interceptor treats 401 as
  // "session expired" and clears the store, which would log the user out in the
  // middle of a password reset just because they mistyped a code.
  it('rejects an unknown OTP without handing out a token', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api().post('/api/v1/auth/verify-otp').send({ email: EMAIL, otp: '000000' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid or expired otp/i);
    expect(response.body.data).toBeUndefined();
  });
});

describe('GET /auth/profile', () => {
  it('401s without a token', async () => {
    const response = await api().get('/api/v1/auth/profile');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
  });

  it('401s for a malformed Authorization header', async () => {
    const response = await api().get('/api/v1/auth/profile').set('Authorization', 'Bearer nonsense');
    expect(response.status).toBe(401);
  });

  it('401s when the scheme is missing entirely', async () => {
    const response = await api()
      .get('/api/v1/auth/profile')
      .set('Authorization', USER.email);
    expect(response.status).toBe(401);
  });

  it('returns the caller profile without credentials', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api().get('/api/v1/auth/profile').set(asUser());

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).toMatchObject({ email: EMAIL });
  });

  it('404s when the account no longer exists', async () => {
    model('user').findUnique.mockResolvedValue(null);

    const response = await api().get('/api/v1/auth/profile').set(asUser());
    expect(response.status).toBe(404);
  });
});

describe('PATCH /auth/profile', () => {
  it('persists an allowed field', async () => {
    model('user').update.mockResolvedValue(storedUser({ fullName: 'Renamed' }));

    const response = await api().patch('/api/v1/auth/profile').set(asUser()).send({ fullName: 'Renamed' });

    expect(response.status).toBe(200);
    expect(model('user').update.mock.calls[0][0].data).toMatchObject({ fullName: 'Renamed' });
  });

  // Mass assignment: `role`/`isActive`/`email` must never be self-serviceable.
  it.each([['role'], ['isActive'], ['email'], ['passwordHash'], ['emailVerified']])(
    'refuses to let a user set %s',
    async (field) => {
      const response = await api()
        .patch('/api/v1/auth/profile')
        .set(asUser())
        .send({ fullName: 'Renamed', [field]: 'ADMIN' });

      expect(response.status).toBe(400);
      expect(response.body.errors.map((e: { field: string }) => e.field)).toContain(field);
      expect(model('user').update).not.toHaveBeenCalled();
    },
  );

  it('rejects an empty patch', async () => {
    const response = await api().patch('/api/v1/auth/profile').set(asUser()).send({});
    expect(response.status).toBe(400);
  });

  it('rejects an invalid preferred payment method', async () => {
    const response = await api()
      .patch('/api/v1/auth/profile')
      .set(asUser())
      .send({ preferredPaymentMethod: 'PAYPAL' });

    expect(response.status).toBe(400);
  });

  it('requires authentication', async () => {
    const response = await api().patch('/api/v1/auth/profile').send({ fullName: 'Renamed' });
    expect(response.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('requires authentication', async () => {
    const response = await api()
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass1' });
    expect(response.status).toBe(401);
  });

  it('401s when the current password is wrong', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());

    const response = await api()
      .post('/api/v1/auth/change-password')
      .set(asUser())
      .send({ currentPassword: 'NotTheRight1', newPassword: 'BrandNewPass1' });

    expect(response.status).toBe(401);
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('stores a new hash when the current password matches', async () => {
    model('user').findUnique.mockResolvedValue(storedUser());
    model('user').update.mockResolvedValue(storedUser());

    const response = await api()
      .post('/api/v1/auth/change-password')
      .set(asUser())
      .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass1' });

    expect(response.status).toBe(200);
    const data = model('user').update.mock.calls[0][0].data;
    expect(data.passwordHash).toBeTruthy();
    expect(data.passwordHash).not.toBe(passwordHash);
    expect(await bcrypt.compare('BrandNewPass1', data.passwordHash)).toBe(true);
  });

  it('enforces the password policy on the new password', async () => {
    const response = await api()
      .post('/api/v1/auth/change-password')
      .set(asUser())
      .send({ currentPassword: PASSWORD, newPassword: 'short' });

    expect(response.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  it('is stateless but always available to clients', async () => {
    const response = await api().post('/api/v1/auth/logout').set(asUser());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, message: 'Logged out' });
  });
});
