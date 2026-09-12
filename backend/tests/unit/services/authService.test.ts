import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { model, prismaError, resetPrismaMock } from '../../helpers/prisma-mock.js';

vi.mock('../../../src/config/database.js', async () => {
  const { prismaMock } = await import('../../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

// Deterministic OTP store: the real one is covered in `utils/otp.test.ts`.
const otpStore = {
  issue: vi.fn(async () => '123456'),
  verify: vi.fn(async () => undefined),
};

vi.mock('../../../src/config/redis.js', () => ({
  getOtpStore: () => ({ name: 'memory' }),
}));

vi.mock('../../../src/utils/otp.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/otp.js')>();
  return {
    ...actual,
    OtpService: class {
      issue = otpStore.issue;
      verify = otpStore.verify;
    },
  };
});

const { authService } = await import('../../../src/services/authService.js');
const { hashPassword } = await import('../../../src/utils/helpers.js');
const { generatePasswordResetToken } = await import('../../../src/utils/tokens.js');

const EMAIL = 'player@gameshop.test';
const USER_ID = '6f1e2c3d-0000-4000-8000-0000000000aa';
const PASSWORD = 'Sup3rSecret';

let passwordHash: string;

beforeEach(async () => {
  resetPrismaMock();
  otpStore.issue.mockClear();
  otpStore.verify.mockClear();
  otpStore.issue.mockResolvedValue('123456');
  otpStore.verify.mockResolvedValue(undefined);

  passwordHash = await hashPassword(PASSWORD);
  model('user').findUnique.mockResolvedValue({
    id: USER_ID,
    email: EMAIL,
    fullName: 'Ada Lovelace',
    passwordHash,
    role: 'USER',
    isActive: true,
  });
  model('user').create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: USER_ID,
    ...args.data,
  }));
  // The stored hash is included so `sanitizeUser` actually has something to strip.
  model('user').update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: USER_ID,
    email: EMAIL,
    fullName: 'Ada Lovelace',
    role: 'USER',
    passwordHash,
    ...args.data,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('register', () => {
  it('creates the user with a hashed password and returns tokens', async () => {
    const result = await authService.register(EMAIL, '01712345678', PASSWORD, 'Ada Lovelace');

    const data = model('user').create.mock.calls[0][0].data;
    expect(data.passwordHash).not.toBe(PASSWORD);
    expect(data.passwordHash.startsWith('$2')).toBe(true);
    expect(data.phone).toBe('01712345678');

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('normalises the email to lower case', async () => {
    await authService.register('Player@GameShop.TEST', undefined, PASSWORD, 'Ada');
    expect(model('user').create.mock.calls[0][0].data.email).toBe('player@gameshop.test');
  });

  it('stores a null phone when none is supplied', async () => {
    await authService.register(EMAIL, undefined, PASSWORD, 'Ada');
    expect(model('user').create.mock.calls[0][0].data.phone).toBeNull();
  });

  // Regression: `findFirst` then `create` was a race — two simultaneous signups
  // both passed the check and the loser surfaced as an HTTP 500.
  it('translates a unique violation into a 409', async () => {
    model('user').create.mockRejectedValue(prismaError('P2002', { target: ['users', 'email'] }));
    await expect(authService.register(EMAIL, undefined, PASSWORD, 'Ada')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('does not pre-check existence (the unique index is the source of truth)', async () => {
    await authService.register(EMAIL, undefined, PASSWORD, 'Ada');
    expect(model('user').findFirst).not.toHaveBeenCalled();
  });

  it('rethrows unrelated database errors', async () => {
    model('user').create.mockRejectedValue(new Error('connection lost'));
    await expect(authService.register(EMAIL, undefined, PASSWORD, 'Ada')).rejects.toThrow('connection lost');
  });
});

describe('login', () => {
  it('returns the user and a token pair on success', async () => {
    const result = await authService.login(EMAIL, PASSWORD);
    expect(result.user.email).toBe(EMAIL);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('records the login timestamp', async () => {
    await authService.login(EMAIL, PASSWORD);
    expect(model('user').update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastLogin: expect.any(Date) } }),
    );
  });

  it('does not fail the login when the timestamp write fails', async () => {
    model('user').update.mockRejectedValue(new Error('write failed'));
    await expect(authService.login(EMAIL, PASSWORD)).resolves.toBeDefined();
  });

  it('rejects a wrong password with a generic 401', async () => {
    await expect(authService.login(EMAIL, 'wrong-password')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('uses the same message for an unknown email (no user enumeration)', async () => {
    model('user').findUnique.mockResolvedValue(null);
    await expect(authService.login('nobody@gameshop.test', PASSWORD)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  // Regression / hardening: an unknown email returned immediately while a known
  // one ran bcrypt, so account existence leaked through response timing.
  it('still runs a bcrypt comparison when the account does not exist', async () => {
    model('user').findUnique.mockResolvedValue(null);
    const started = process.hrtime.bigint();
    await expect(authService.login('nobody@gameshop.test', PASSWORD)).rejects.toThrow();
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    // A bcrypt(10) comparison costs several milliseconds; an early return is <1ms.
    expect(elapsedMs).toBeGreaterThan(2);
  });

  it('rejects a disabled account with 403', async () => {
    model('user').findUnique.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      passwordHash,
      role: 'USER',
      isActive: false,
    });
    await expect(authService.login(EMAIL, PASSWORD)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('is case-insensitive about the email address', async () => {
    await authService.login('PLAYER@gameshop.TEST', PASSWORD);
    expect(model('user').findUnique).toHaveBeenCalledWith({ where: { email: EMAIL } });
  });
});

describe('refresh', () => {
  it('issues a new token pair for a valid refresh token', async () => {
    const { generateRefreshToken } = await import('../../../src/utils/tokens.js');
    const result = await authService.refresh(generateRefreshToken(USER_ID));
    expect(result.accessToken).toBeTruthy();
    expect(result.user.id).toBe(USER_ID);
  });

  it('rejects an access token presented as a refresh token', async () => {
    const { generateAccessToken } = await import('../../../src/utils/tokens.js');
    const access = generateAccessToken({ id: USER_ID, email: EMAIL, role: 'USER' });
    await expect(authService.refresh(access)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects garbage', async () => {
    await expect(authService.refresh('not-a-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a refresh token for a deleted account', async () => {
    const { generateRefreshToken } = await import('../../../src/utils/tokens.js');
    model('user').findUnique.mockResolvedValue(null);
    await expect(authService.refresh(generateRefreshToken('gone'))).rejects.toThrow(/no longer exists/);
  });

  it('rejects a refresh token for a disabled account', async () => {
    const { generateRefreshToken } = await import('../../../src/utils/tokens.js');
    model('user').findUnique.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      passwordHash,
      role: 'USER',
      isActive: false,
    });
    await expect(authService.refresh(generateRefreshToken(USER_ID))).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('forgotPassword', () => {
  it('issues an OTP for a known address', async () => {
    const result = await authService.forgotPassword(EMAIL);
    expect(otpStore.issue).toHaveBeenCalledWith(EMAIL);
    expect(result.message).toMatch(/If the email exists/);
  });

  // Regression: the two branches returned different messages, which made the
  // endpoint a user-enumeration oracle.
  it('returns an identical response for an unknown address', async () => {
    model('user').findUnique.mockResolvedValue(null);
    const result = await authService.forgotPassword('nobody@gameshop.test');

    expect(result.message).toMatch(/If the email exists/);
    expect(otpStore.issue).not.toHaveBeenCalled();
  });

  it('never leaks the OTP in the response body', async () => {
    const result = await authService.forgotPassword(EMAIL);
    expect(JSON.stringify(result)).not.toContain('123456');
  });
});

describe('verifyOTP', () => {
  it('returns a single-purpose reset token on success', async () => {
    const result = await authService.verifyOTP(EMAIL, '123456');
    expect(otpStore.verify).toHaveBeenCalledWith(EMAIL, '123456');
    expect(result.resetToken).toBeTruthy();
    expect(result.expiresInSeconds).toBeGreaterThan(0);
  });

  it('propagates an OTP failure', async () => {
    otpStore.verify.mockRejectedValueOnce(Object.assign(new Error('Invalid or expired OTP'), { statusCode: 400 }));
    await expect(authService.verifyOTP(EMAIL, '000000')).rejects.toThrow(/Invalid or expired OTP/);
  });

  // Regression: the reset token was signed with the ACCESS secret and had no
  // type claim, so `authenticateToken` accepted it as a session credential.
  it('issues a token that cannot be used as an access token', async () => {
    const { verifyAccessToken } = await import('../../../src/utils/tokens.js');
    const { resetToken } = await authService.verifyOTP(EMAIL, '123456');
    expect(() => verifyAccessToken(resetToken)).toThrow();
  });

  it('404s when the OTP was valid but the account vanished', async () => {
    model('user').findUnique.mockResolvedValue(null);
    await expect(authService.verifyOTP(EMAIL, '123456')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('resetPassword', () => {
  it('changes the password with a valid token', async () => {
    const token = generatePasswordResetToken(EMAIL, passwordHash);
    const result = await authService.resetPassword(EMAIL, 'BrandNew1Pass', token);

    expect(result.message).toMatch(/successful/i);
    const written = model('user').update.mock.calls.at(-1)![0].data.passwordHash;
    expect(written).not.toBe(passwordHash);
    expect(written.startsWith('$2')).toBe(true);
  });

  // ── CRITICAL REGRESSION ─────────────────────────────────────────────────
  // The endpoint used to accept `{ email, password }` with no token at all, so
  // any anonymous caller could overwrite any account's password.
  it('refuses to reset without a token', async () => {
    await expect(
      authService.resetPassword(EMAIL, 'BrandNew1Pass', undefined as unknown as string),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('refuses a forged token', async () => {
    await expect(
      authService.resetPassword(EMAIL, 'BrandNew1Pass', 'header.payload.signature'),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('refuses a token issued for a different account', async () => {
    const token = generatePasswordResetToken('someone.else@gameshop.test', passwordHash);
    await expect(authService.resetPassword(EMAIL, 'BrandNew1Pass', token)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('refuses to reuse a token after the password has changed (single use)', async () => {
    const token = generatePasswordResetToken(EMAIL, passwordHash);
    await authService.resetPassword(EMAIL, 'BrandNew1Pass', token);

    // The stored hash is now different, so the token's fingerprint no longer matches.
    const newHash = model('user').update.mock.calls.at(-1)![0].data.passwordHash;
    model('user').findUnique.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      passwordHash: newHash,
      role: 'USER',
      isActive: true,
    });

    await expect(authService.resetPassword(EMAIL, 'Another1Pass', token)).rejects.toThrow(/already been used/);
  });

  it('refuses an access token presented as a reset token', async () => {
    const { generateAccessToken } = await import('../../../src/utils/tokens.js');
    const access = generateAccessToken({ id: USER_ID, email: EMAIL, role: 'USER' });
    await expect(authService.resetPassword(EMAIL, 'BrandNew1Pass', access)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('refuses to set the same password again', async () => {
    const token = generatePasswordResetToken(EMAIL, passwordHash);
    await expect(authService.resetPassword(EMAIL, PASSWORD, token)).rejects.toThrow(/must be different/);
  });

  it('404s for an unknown account', async () => {
    model('user').findUnique.mockResolvedValue(null);
    const token = generatePasswordResetToken(EMAIL, passwordHash);
    await expect(authService.resetPassword(EMAIL, 'BrandNew1Pass', token)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('changePassword', () => {
  it('requires the correct current password', async () => {
    await expect(authService.changePassword(USER_ID, 'wrong', 'BrandNew1Pass')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('updates the hash when the current password matches', async () => {
    const result = await authService.changePassword(USER_ID, PASSWORD, 'BrandNew1Pass');
    expect(result.message).toMatch(/updated/i);
    expect(model('user').update.mock.calls.at(-1)![0].data.passwordHash).not.toBe(passwordHash);
  });

  it('refuses to reuse the current password', async () => {
    await expect(authService.changePassword(USER_ID, PASSWORD, PASSWORD)).rejects.toThrow(/must be different/);
  });

  it('404s for an unknown user', async () => {
    model('user').findUnique.mockResolvedValue(null);
    await expect(authService.changePassword('nope', PASSWORD, 'BrandNew1Pass')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('getProfile', () => {
  it('returns the user without the password hash', async () => {
    const profile = await authService.getProfile(USER_ID);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile.email).toBe(EMAIL);
  });

  it('404s for an unknown user', async () => {
    model('user').findUnique.mockResolvedValue(null);
    await expect(authService.getProfile('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('updateProfile', () => {
  // ── CRITICAL REGRESSION ─────────────────────────────────────────────────
  // `req.body` was forwarded straight to Prisma, so a customer could promote
  // themselves by PATCHing `{ "role": "SUPER_ADMIN" }`.
  it.each([
    ['role', 'SUPER_ADMIN'],
    ['isActive', false],
    ['emailVerified', true],
    ['passwordHash', 'attacker-hash'],
    ['email', 'attacker@evil.test'],
    ['id', 'someone-else'],
    ['createdAt', '1970-01-01'],
  ])('never writes the privileged column "%s"', async (field, value) => {
    await authService.updateProfile(USER_ID, { fullName: 'Ada', [field]: value });

    const data = model('user').update.mock.calls.at(-1)![0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty(field);
    expect(data.fullName).toBe('Ada');
  });

  it('writes every allowed profile field', async () => {
    await authService.updateProfile(USER_ID, {
      fullName: 'Ada L',
      phone: '01812345678',
      division: 'Dhaka',
      district: 'Dhaka',
      address: 'House 12',
      postalCode: '1205',
      preferredPaymentMethod: 'NAGAD',
      notificationPreferences: { orderUpdates: true },
    });

    expect(model('user').update.mock.calls.at(-1)![0].data).toMatchObject({
      fullName: 'Ada L',
      phone: '01812345678',
      division: 'Dhaka',
      postalCode: '1205',
      preferredPaymentMethod: 'NAGAD',
    });
  });

  it('omits fields that were not supplied instead of nulling them', async () => {
    await authService.updateProfile(USER_ID, { fullName: 'Ada' });
    const data = model('user').update.mock.calls.at(-1)![0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['fullName']);
  });

  it('rejects an empty update', async () => {
    await expect(authService.updateProfile(USER_ID, {})).rejects.toMatchObject({ statusCode: 400 });
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('translates a duplicate phone into a 409', async () => {
    model('user').update.mockRejectedValue(prismaError('P2002', { target: ['users', 'phone'] }));
    await expect(authService.updateProfile(USER_ID, { phone: '01712345678' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('translates a missing user into a 404', async () => {
    model('user').update.mockRejectedValue(prismaError('P2025'));
    await expect(authService.updateProfile(USER_ID, { fullName: 'Ada' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('strips the password hash from the response', async () => {
    const result = await authService.updateProfile(USER_ID, { fullName: 'Ada' });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
