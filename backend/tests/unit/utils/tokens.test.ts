import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env.js';
import {
  fingerprintPasswordHash,
  generateAccessToken,
  generateOTP,
  generatePasswordResetToken,
  generateRefreshToken,
  TOKEN_TYPE,
  verifyAccessToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from '../../../src/utils/tokens.js';

const user = { id: 'user-1', email: 'player@gameshop.test', role: 'USER' };

describe('generateAccessToken / verifyAccessToken', () => {
  it('round-trips the session claims', () => {
    const token = generateAccessToken(user);
    expect(verifyAccessToken(token)).toEqual({ ...user, type: TOKEN_TYPE.ACCESS });
  });

  it('stamps the token type', () => {
    const decoded = jwt.verify(generateAccessToken(user), env.jwt.secret) as Record<string, unknown>;
    expect(decoded.type).toBe('access');
  });

  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ ...user, type: 'access' }, 'a-completely-different-secret-value');
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects a malformed payload', () => {
    const partial = jwt.sign({ type: 'access' }, env.jwt.secret);
    expect(() => verifyAccessToken(partial)).toThrow(/Malformed/);
  });

  // Regression: the password-reset token used to be signed with the *access*
  // secret and carried no type claim, so `authenticateToken` accepted it as a
  // session — an anonymous caller could hold a valid (if odd) API token.
  it('rejects a refresh token presented as an access token', () => {
    // Different signing secret -> the signature check fails outright.
    expect(() => verifyAccessToken(generateRefreshToken('user-1'))).toThrow();
  });

  it('rejects a password-reset token presented as an access token', () => {
    expect(() => verifyAccessToken(generatePasswordResetToken(user.email, 'hash'))).toThrow();
  });

  it('rejects a foreign-purpose token even when signed with the access secret', () => {
    // Defence in depth: if an operator ever points both secrets at the same
    // value, the `type` claim alone must still stop token confusion.
    const asRefresh = jwt.sign({ id: 'user-1', type: 'refresh' }, env.jwt.secret);
    expect(() => verifyAccessToken(asRefresh)).toThrow(/Wrong token type/);

    const asReset = jwt.sign({ email: user.email, type: 'password_reset', phf: 'x' }, env.jwt.secret);
    expect(() => verifyAccessToken(asReset)).toThrow(/Wrong token type/);
  });

  it('still accepts legacy tokens minted before the type claim existed', () => {
    const legacy = jwt.sign(user, env.jwt.secret, { expiresIn: '1h' });
    expect(verifyAccessToken(legacy)).toMatchObject({ id: 'user-1', role: 'USER' });
  });
});

describe('generateRefreshToken / verifyRefreshToken', () => {
  it('round-trips the subject', () => {
    const token = generateRefreshToken('user-42');
    expect(verifyRefreshToken(token)).toMatchObject({ id: 'user-42', type: TOKEN_TYPE.REFRESH });
  });

  it('issues a unique jti per call so tokens can be tracked', () => {
    const a = jwt.verify(generateRefreshToken('u'), env.jwt.refreshSecret) as { jti: string };
    const b = jwt.verify(generateRefreshToken('u'), env.jwt.refreshSecret) as { jti: string };
    expect(a.jti).not.toBe(b.jti);
  });

  it('rejects an access token used as a refresh token', () => {
    expect(() => verifyRefreshToken(generateAccessToken(user))).toThrow();
  });
});

describe('password reset tokens', () => {
  const hash = '$2a$10$abcdefghijklmnopqrstuv';

  it('round-trips the email and hash fingerprint', () => {
    const token = generatePasswordResetToken('player@gameshop.test', hash);
    const payload = verifyPasswordResetToken(token);
    expect(payload.email).toBe('player@gameshop.test');
    expect(payload.type).toBe(TOKEN_TYPE.PASSWORD_RESET);
    expect(payload.phf).toBe(fingerprintPasswordHash(hash));
  });

  it('produces a different fingerprint once the password changes', () => {
    // This is what makes the token single-use without any extra storage.
    expect(fingerprintPasswordHash(hash)).not.toBe(fingerprintPasswordHash(`${hash}x`));
  });

  it('fingerprints are stable and fixed length', () => {
    expect(fingerprintPasswordHash(hash)).toBe(fingerprintPasswordHash(hash));
    expect(fingerprintPasswordHash(hash)).toHaveLength(16);
  });

  it('rejects an access token presented as a reset token', () => {
    expect(() => verifyPasswordResetToken(generateAccessToken(user))).toThrow();
  });
});

describe('generateOTP', () => {
  it('produces a 6 digit zero-padded code', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOTP()).toMatch(/^\d{6}$/);
    }
  });

  it('honours a custom length', () => {
    expect(generateOTP(8)).toMatch(/^\d{8}$/);
    expect(generateOTP(4)).toMatch(/^\d{4}$/);
  });

  it('is not constant across calls (crypto-backed, not Math.random)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOTP()));
    expect(codes.size).toBeGreaterThan(40);
  });

  it('can produce codes with leading zeros', () => {
    // `Math.floor(100000 + Math.random()*900000)` could never start with 0,
    // which both reduced entropy and was an obvious tell.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(generateOTP().slice(0, 1));
    expect(seen.size).toBe(10);
  });
});
