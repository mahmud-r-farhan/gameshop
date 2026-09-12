import { env } from './env.js';
import { MemoryOtpStore, RedisOtpStore, type OtpStore, type RedisLike } from '../utils/otp.js';

/**
 * Optional Redis wiring.
 *
 * Redis backs the OTP store so verification works across replicas. It is
 * deliberately *optional*: when `REDIS_URL` is unset — or the server is
 * unreachable — we degrade to the in-memory store and log a warning rather than
 * crashing the API. Everything Redis provides here is an optimisation, never a
 * correctness requirement.
 */

let otpStore: OtpStore | null = null;
let redisClient: RedisLike | null = null;

function log(message: string): void {
  if (!env.isTest) console.log(message);
}

function warn(message: string): void {
  if (!env.isTest) console.warn(message);
}

async function createRedisClient(): Promise<RedisLike | null> {
  if (!env.redis.enabled) return null;

  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(env.redis.url, {
      // Fail fast instead of retrying forever during boot.
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
      lazyConnect: false,
      enableOfflineQueue: false,
    });

    client.on('error', (error: Error) => {
      warn(`⚠️  Redis error: ${error.message}`);
    });

    // Prove the connection before we depend on it.
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 2500)),
    ]);

    log('✅ Redis connected');
    return client as unknown as RedisLike;
  } catch (error) {
    warn(`⚠️  Redis unavailable (${(error as Error).message}) — falling back to in-memory OTP store`);
    return null;
  }
}

/** Initialise shared infrastructure. Safe to call more than once. */
export async function initInfra(): Promise<{ otpStore: OtpStore }> {
  if (otpStore) return { otpStore };

  redisClient = await createRedisClient();
  otpStore = redisClient ? new RedisOtpStore(redisClient) : new MemoryOtpStore();
  log(`🔑 OTP store: ${otpStore.name}`);

  return { otpStore };
}

export function getOtpStore(): OtpStore {
  if (!otpStore) otpStore = new MemoryOtpStore();
  return otpStore;
}

export function getRedis(): RedisLike | null {
  return redisClient;
}

/** Test seam: swap the store without touching Redis. */
export function setOtpStore(store: OtpStore): void {
  otpStore = store;
}

export async function disconnectInfra(): Promise<void> {
  if (otpStore) {
    await otpStore.disconnect().catch(() => undefined);
    otpStore = null;
  }
  redisClient = null;
}
