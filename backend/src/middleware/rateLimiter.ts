import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiters.
 *
 * `app.set('trust proxy', …)` is configured in `app.ts`. Without it every
 * request behind nginx appears to come from the proxy's own IP, so a single
 * abusive client would exhaust the shared budget and lock out the entire user
 * base.
 *
 * Each limiter is declared explicitly (rather than spread from a bag of
 * options) because `express-rate-limit` v7 validates its configuration and
 * warns on unknown keys.
 */

interface LimiterConfig {
  windowMs: number;
  max: number;
  error: string;
  /**
   * Bypass the limiter entirely. The exported limiters set this to
   * `env.isTest`: a supertest run issues every request from 127.0.0.1, so a
   * shared in-memory bucket would start returning 429 part-way through the
   * suite and make the failures look like application bugs. `createLimiter` is
   * exported so the limiter itself can still be unit-tested with `skip` unset.
   */
  skip?: () => boolean;
}

export function createLimiter({ windowMs, max, error, skip }: LimiterConfig) {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, error },
    standardHeaders: true,
    legacyHeaders: false,
    ...(skip ? { skip } : {}),
  });
}

const skipInTest = () => env.isTest;

/** Brute-force protection for credential checks. */
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  error: 'Too many login attempts, please try again later',
  skip: skipInTest,
});

/** General API budget per client per minute. */
export const apiLimiter = createLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  error: 'Too many requests, please try again later',
  skip: skipInTest,
});

/** Signup / password-reset endpoints. */
export const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  error: 'Too many authentication attempts, please try again later',
  skip: skipInTest,
});

/** OTP issuance — tighter than `authLimiter` to stop mail/SMS bombing. */
export const otpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  error: 'Too many OTP requests, please try again later',
  skip: skipInTest,
});

/** OTP verification — bounds the online brute-force search space. */
export const otpVerifyLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  error: 'Too many verification attempts, please try again later',
  skip: skipInTest,
});

/** Write-heavy admin operations. */
export const adminWriteLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  error: 'Too many admin operations, please slow down',
  skip: skipInTest,
});
