import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateOTP } from './tokens.js';

/**
 * One-time-password storage and verification.
 *
 * The previous implementation kept OTPs on `globalThis`, which breaks the moment
 * the API runs with more than one replica (the instance that issued the OTP is
 * rarely the one that verifies it), never expired entries, and allowed unlimited
 * guesses against a 6-digit code — a 1-in-a-million search that a script wins in
 * minutes.
 *
 * This module is backend-agnostic: Redis when configured (shared across
 * replicas), in-memory otherwise, with identical expiry + throttling semantics.
 */

export interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
}

export interface OtpStore {
  readonly name: 'redis' | 'memory';
  set(key: string, otp: string, ttlMs: number): Promise<void>;
  get(key: string): Promise<OtpRecord | null>;
  /** Bump the wrong-attempt counter without resetting expiry. Returns the new count. */
  registerFailedAttempt(key: string): Promise<number>;
  delete(key: string): Promise<void>;
  /** Requests already made inside the current throttle window. */
  throttleCount(key: string): Promise<number>;
  throttleIncr(key: string, ttlMs: number): Promise<number>;
  disconnect(): Promise<void>;
}

const otpKey = (key: string) => `otp:${key}`;
const throttleKey = (key: string) => `otp-throttle:${key}`;

export class MemoryOtpStore implements OtpStore {
  readonly name = 'memory' as const;
  private records = new Map<string, OtpRecord>();
  private throttles = new Map<string, { count: number; expiresAt: number }>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic sweep keeps memory bounded instead of relying on lazy expiry.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref?.();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, value] of this.records) {
      if (value.expiresAt <= now) this.records.delete(key);
    }
    for (const [key, value] of this.throttles) {
      if (value.expiresAt <= now) this.throttles.delete(key);
    }
  }

  async set(key: string, otp: string, ttlMs: number): Promise<void> {
    this.records.set(otpKey(key), { otp, expiresAt: Date.now() + ttlMs, attempts: 0 });
  }

  async get(key: string): Promise<OtpRecord | null> {
    const record = this.records.get(otpKey(key));
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.records.delete(otpKey(key));
      return null;
    }
    return record;
  }

  async registerFailedAttempt(key: string): Promise<number> {
    const record = this.records.get(otpKey(key));
    if (!record) return 0;
    record.attempts += 1;
    return record.attempts;
  }

  async delete(key: string): Promise<void> {
    this.records.delete(otpKey(key));
  }

  async throttleCount(key: string): Promise<number> {
    const entry = this.throttles.get(throttleKey(key));
    if (!entry || entry.expiresAt <= Date.now()) return 0;
    return entry.count;
  }

  async throttleIncr(key: string, ttlMs: number): Promise<number> {
    const mapKey = throttleKey(key);
    const now = Date.now();
    const entry = this.throttles.get(mapKey);
    if (!entry || entry.expiresAt <= now) {
      this.throttles.set(mapKey, { count: 1, expiresAt: now + ttlMs });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async disconnect(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    this.records.clear();
    this.throttles.clear();
  }
}

/** Minimal slice of `ioredis` we rely on — keeps this module trivially mockable. */
export interface RedisLike {
  set(key: string, value: string, mode: 'PX', ttl: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  pexpire(key: string, ttl: number): Promise<unknown>;
  quit(): Promise<unknown>;
}

export class RedisOtpStore implements OtpStore {
  readonly name = 'redis' as const;

  constructor(private readonly client: RedisLike) {}

  async set(key: string, otp: string, ttlMs: number): Promise<void> {
    const record: OtpRecord = { otp, expiresAt: Date.now() + ttlMs, attempts: 0 };
    await this.client.set(otpKey(key), JSON.stringify(record), 'PX', ttlMs);
  }

  async get(key: string): Promise<OtpRecord | null> {
    const raw = await this.client.get(otpKey(key));
    if (!raw) return null;
    try {
      const record = JSON.parse(raw) as OtpRecord;
      if (record.expiresAt <= Date.now()) {
        await this.client.del(otpKey(key));
        return null;
      }
      return record;
    } catch {
      await this.client.del(otpKey(key));
      return null;
    }
  }

  async registerFailedAttempt(key: string): Promise<number> {
    const record = await this.get(key);
    if (!record) return 0;
    record.attempts += 1;
    const remaining = Math.max(record.expiresAt - Date.now(), 1);
    await this.client.set(otpKey(key), JSON.stringify(record), 'PX', remaining);
    return record.attempts;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(otpKey(key));
  }

  async throttleCount(key: string): Promise<number> {
    const raw = await this.client.get(throttleKey(key));
    return raw ? Number.parseInt(raw, 10) || 0 : 0;
  }

  async throttleIncr(key: string, ttlMs: number): Promise<number> {
    const count = await this.client.incr(throttleKey(key));
    if (count === 1) await this.client.pexpire(throttleKey(key), ttlMs);
    return count;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export interface OtpServiceOptions {
  ttlMs?: number;
  maxAttempts?: number;
  resendCooldownMs?: number;
  maxPerHour?: number;
}

/**
 * High-level OTP operations shared by every caller.
 *
 * Enforces a resend cooldown and hourly cap per email (stops OTP bombing and
 * SMS/mail cost abuse) plus a bounded number of verification attempts per
 * issued code (stops brute force).
 */
export class OtpService {
  constructor(
    private readonly store: OtpStore,
    private readonly options: OtpServiceOptions = {},
  ) {}

  private get ttlMs(): number {
    return this.options.ttlMs ?? env.otp.ttlMs;
  }
  private get maxAttempts(): number {
    return this.options.maxAttempts ?? env.otp.maxAttempts;
  }
  private get resendCooldownMs(): number {
    return this.options.resendCooldownMs ?? env.otp.resendCooldownMs;
  }
  private get maxPerHour(): number {
    return this.options.maxPerHour ?? env.otp.maxPerHour;
  }

  /** Issue a fresh OTP. Throws 429 when the caller is being throttled. */
  async issue(email: string): Promise<string> {
    const key = email.toLowerCase();

    const used = await this.store.throttleCount(key);
    if (used >= this.maxPerHour) {
      throw new AppError('Too many OTP requests. Please try again later.', 429);
    }

    const existing = await this.store.get(key);
    if (existing && existing.expiresAt - Date.now() > this.ttlMs - this.resendCooldownMs) {
      throw new AppError('An OTP was just sent. Please wait before requesting another.', 429);
    }

    const otp = generateOTP();
    await this.store.set(key, otp, this.ttlMs);
    await this.store.throttleIncr(key, 60 * 60 * 1000);
    return otp;
  }

  /**
   * Verify and consume an OTP. The code is deleted on success and once the
   * attempt budget is exhausted, so it can never be replayed.
   */
  async verify(email: string, submitted: string): Promise<void> {
    const key = email.toLowerCase();
    const record = await this.store.get(key);

    if (!record) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    if (!timingSafeEqualStr(record.otp, submitted)) {
      const attempts = await this.store.registerFailedAttempt(key);
      if (attempts >= this.maxAttempts) {
        await this.store.delete(key);
        throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
      }
      throw new AppError('Invalid or expired OTP', 400);
    }

    await this.store.delete(key);
  }
}

/** Length-independent comparison so the code cannot be recovered via timing. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
