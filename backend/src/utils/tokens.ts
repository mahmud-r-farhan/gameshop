import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Every JWT we mint carries a `type` claim so a token issued for one purpose
 * can never be replayed for another. Previously the password-reset token was
 * signed with the *access token* secret and no type, which meant a reset token
 * was accepted by `authenticateToken` as a (broken, empty-id) session.
 */
export const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  PASSWORD_RESET: 'password_reset',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export interface AccessTokenPayload extends SessionUser {
  type: typeof TOKEN_TYPE.ACCESS;
}

export interface RefreshTokenPayload {
  id: string;
  type: typeof TOKEN_TYPE.REFRESH;
}

export interface PasswordResetTokenPayload {
  email: string;
  type: typeof TOKEN_TYPE.PASSWORD_RESET;
  /** Fingerprint of the password hash the token was issued against. */
  phf: string;
}

function sign(payload: object, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function generateAccessToken(user: SessionUser): string {
  return sign(
    { id: user.id, email: user.email, role: user.role, type: TOKEN_TYPE.ACCESS },
    env.jwt.secret,
    env.jwt.expiresIn,
  );
}

export function generateRefreshToken(userId: string): string {
  return sign(
    { id: userId, type: TOKEN_TYPE.REFRESH, jti: crypto.randomUUID() },
    env.jwt.refreshSecret,
    env.jwt.refreshExpiresIn,
  );
}

/**
 * Short-lived, single-purpose token authorising a password change.
 *
 * `passwordHashFingerprint` binds the token to the current credential: once the
 * password changes the fingerprint no longer matches and the token dies, giving
 * us single-use semantics without extra storage.
 */
export function generatePasswordResetToken(email: string, passwordHash: string): string {
  return sign(
    {
      email,
      type: TOKEN_TYPE.PASSWORD_RESET,
      phf: fingerprintPasswordHash(passwordHash),
    },
    env.jwt.refreshSecret,
    env.jwt.resetExpiresIn,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwt.secret) as Partial<AccessTokenPayload> & { type?: string };
  // Tokens minted before `type` was introduced are still accepted as access
  // tokens so an in-flight session is not dropped mid-deploy.
  if (decoded.type !== undefined && decoded.type !== TOKEN_TYPE.ACCESS) {
    throw new jwt.JsonWebTokenError('Wrong token type');
  }
  if (!decoded.id || !decoded.email || !decoded.role) {
    throw new jwt.JsonWebTokenError('Malformed access token');
  }
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    type: TOKEN_TYPE.ACCESS,
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwt.refreshSecret) as Partial<RefreshTokenPayload>;
  if (decoded.type !== TOKEN_TYPE.REFRESH || !decoded.id) {
    throw new jwt.JsonWebTokenError('Malformed refresh token');
  }
  return { id: decoded.id, type: TOKEN_TYPE.REFRESH };
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
  const decoded = jwt.verify(token, env.jwt.refreshSecret) as Partial<PasswordResetTokenPayload>;
  if (decoded.type !== TOKEN_TYPE.PASSWORD_RESET || !decoded.email || !decoded.phf) {
    throw new jwt.JsonWebTokenError('Malformed password reset token');
  }
  return {
    email: decoded.email,
    type: TOKEN_TYPE.PASSWORD_RESET,
    phf: decoded.phf,
  };
}

/** Stable, non-reversible fingerprint of a password hash. */
export function fingerprintPasswordHash(passwordHash: string): string {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

/** Cryptographically strong 6-digit OTP. `Math.random()` is not acceptable here. */
export function generateOTP(length = 6): string {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(length, '0');
}
