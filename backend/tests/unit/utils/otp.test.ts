import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryOtpStore,
  OtpService,
  RedisOtpStore,
  timingSafeEqualStr,
  type RedisLike,
} from '../../../src/utils/otp.js';

const FAST_OPTIONS = {
  ttlMs: 60_000,
  maxAttempts: 3,
  resendCooldownMs: 30_000,
  maxPerHour: 3,
};

const email = 'player@gameshop.test';

describe('timingSafeEqualStr', () => {
  it('matches identical strings', () => {
    expect(timingSafeEqualStr('123456', '123456')).toBe(true);
  });

  it('rejects different strings of the same length', () => {
    expect(timingSafeEqualStr('123456', '123457')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(timingSafeEqualStr('123456', '1234')).toBe(false);
    expect(timingSafeEqualStr('12', '123456')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(timingSafeEqualStr(undefined as unknown as string, '123456')).toBe(false);
    expect(timingSafeEqualStr('123456', null as unknown as string)).toBe(false);
  });
});

describe('MemoryOtpStore', () => {
  let store: MemoryOtpStore;

  beforeEach(() => {
    store = new MemoryOtpStore();
  });

  afterEach(async () => {
    await store.disconnect();
  });

  it('stores and retrieves a record', async () => {
    await store.set('a', '111111', 60_000);
    const record = await store.get('a');
    expect(record).toMatchObject({ otp: '111111', attempts: 0 });
  });

  it('expires records', async () => {
    await store.set('a', '111111', 10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await store.get('a')).toBeNull();
  });

  it('counts failed attempts without resetting expiry', async () => {
    await store.set('a', '111111', 60_000);
    expect(await store.registerFailedAttempt('a')).toBe(1);
    expect(await store.registerFailedAttempt('a')).toBe(2);
    expect((await store.get('a'))?.attempts).toBe(2);
  });

  it('returns 0 attempts for an unknown key', async () => {
    expect(await store.registerFailedAttempt('missing')).toBe(0);
  });

  it('deletes on demand', async () => {
    await store.set('a', '111111', 60_000);
    await store.delete('a');
    expect(await store.get('a')).toBeNull();
  });

  it('throttles within a window and expires after it', async () => {
    expect(await store.throttleCount('a')).toBe(0);
    expect(await store.throttleIncr('a', 50)).toBe(1);
    expect(await store.throttleIncr('a', 50)).toBe(2);
    expect(await store.throttleCount('a')).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(await store.throttleCount('a')).toBe(0);
  });
});

describe('OtpService (memory store)', () => {
  let store: MemoryOtpStore;
  let service: OtpService;

  beforeEach(() => {
    store = new MemoryOtpStore();
    service = new OtpService(store, FAST_OPTIONS);
  });

  afterEach(async () => {
    await store.disconnect();
  });

  it('issues a 6 digit code', async () => {
    expect(await service.issue(email)).toMatch(/^\d{6}$/);
  });

  it('verifies and consumes the code', async () => {
    const otp = await service.issue(email);
    await expect(service.verify(email, otp)).resolves.toBeUndefined();
    // Consumed: replaying the same code must fail.
    await expect(service.verify(email, otp)).rejects.toThrow(/Invalid or expired OTP/);
  });

  it('is case-insensitive about the email address', async () => {
    const otp = await service.issue('Player@GameShop.TEST');
    await expect(service.verify(email.toUpperCase(), otp)).resolves.toBeUndefined();
  });

  it('rejects an unknown code', async () => {
    await service.issue(email);
    await expect(service.verify(email, '000000')).rejects.toThrow(/Invalid or expired OTP/);
  });

  it('rejects verification with no code issued', async () => {
    await expect(service.verify(email, '123456')).rejects.toThrow(/Invalid or expired OTP/);
  });

  // Regression: the old implementation allowed unlimited guesses, so a 6-digit
  // code was brute-forceable in minutes.
  it('locks the code after the attempt budget is exhausted', async () => {
    const otp = await service.issue(email);

    await expect(service.verify(email, '000000')).rejects.toThrow(/Invalid or expired OTP/);
    await expect(service.verify(email, '000001')).rejects.toThrow(/Invalid or expired OTP/);
    await expect(service.verify(email, '000002')).rejects.toThrow(/Too many incorrect attempts/);

    // The code is destroyed, so even the correct value no longer works.
    await expect(service.verify(email, otp)).rejects.toThrow(/Invalid or expired OTP/);
  });

  it('enforces a resend cooldown', async () => {
    await service.issue(email);
    await expect(service.issue(email)).rejects.toThrow(/just sent/);
  });

  it('enforces an hourly cap', async () => {
    const service2 = new OtpService(store, { ...FAST_OPTIONS, resendCooldownMs: 0 });
    await service2.issue(email);
    await service2.issue(email);
    await service2.issue(email);
    await expect(service2.issue(email)).rejects.toThrow(/Too many OTP requests/);
  });

  it('expires the code after the TTL', async () => {
    vi.useFakeTimers();
    try {
      const shortLived = new OtpService(store, { ...FAST_OPTIONS, ttlMs: 1000 });
      const otp = await shortLived.issue(email);
      vi.advanceTimersByTime(1500);
      await expect(shortLived.verify(email, otp)).rejects.toThrow(/Invalid or expired OTP/);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Minimal in-memory stand-in for ioredis, asserting the same contract. */
function createFakeRedis(): RedisLike & { store: Map<string, string>; ttls: Map<string, number> } {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  return {
    store,
    ttls,
    async set(key, value, _mode, ttl) {
      store.set(key, value);
      ttls.set(key, ttl);
      return 'OK';
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async del(key) {
      store.delete(key);
      ttls.delete(key);
      return 1;
    },
    async incr(key) {
      const next = (Number.parseInt(store.get(key) ?? '0', 10) || 0) + 1;
      store.set(key, String(next));
      return next;
    },
    async pexpire(key, ttl) {
      ttls.set(key, ttl);
      return 1;
    },
    async quit() {
      store.clear();
      return 'OK';
    },
  };
}

describe('RedisOtpStore', () => {
  it('persists records as JSON with a millisecond TTL', async () => {
    const redis = createFakeRedis();
    const store = new RedisOtpStore(redis);

    await store.set('a', '654321', 60_000);
    expect(redis.store.get('otp:a')).toContain('654321');
    expect(redis.ttls.get('otp:a')).toBe(60_000);
    expect(await store.get('a')).toMatchObject({ otp: '654321', attempts: 0 });
  });

  it('round-trips failed attempts', async () => {
    const store = new RedisOtpStore(createFakeRedis());
    await store.set('a', '654321', 60_000);
    expect(await store.registerFailedAttempt('a')).toBe(1);
    expect(await store.registerFailedAttempt('a')).toBe(2);
    expect((await store.get('a'))?.attempts).toBe(2);
  });

  it('recovers from corrupt stored data instead of throwing', async () => {
    const redis = createFakeRedis();
    const store = new RedisOtpStore(redis);
    redis.store.set('otp:a', '{not-json');
    expect(await store.get('a')).toBeNull();
  });

  it('treats an elapsed expiry as a miss', async () => {
    const redis = createFakeRedis();
    const store = new RedisOtpStore(redis);
    await store.set('a', '654321', 60_000);
    const raw = JSON.parse(redis.store.get('otp:a')!) as { expiresAt: number };
    raw.expiresAt = Date.now() - 1;
    redis.store.set('otp:a', JSON.stringify(raw));
    expect(await store.get('a')).toBeNull();
  });

  it('throttles using INCR and sets the TTL on the first hit', async () => {
    const redis = createFakeRedis();
    const store = new RedisOtpStore(redis);
    expect(await store.throttleIncr('a', 5000)).toBe(1);
    expect(redis.ttls.get('otp-throttle:a')).toBe(5000);
    expect(await store.throttleIncr('a', 5000)).toBe(2);
    expect(await store.throttleCount('a')).toBe(2);
  });

  it('works end-to-end through OtpService', async () => {
    const store = new RedisOtpStore(createFakeRedis());
    const service = new OtpService(store, FAST_OPTIONS);

    const otp = await service.issue(email);
    await expect(service.verify(email, '000000')).rejects.toThrow();
    await expect(service.verify(email, otp)).resolves.toBeUndefined();
  });
});
