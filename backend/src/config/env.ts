import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment validation.
 *
 * The old config silently substituted `dev-jwt-secret-change-in-production`
 * when `JWT_SECRET` was missing. In production that means every deployment
 * without the variable set shares a publicly-known signing key — anyone can
 * forge an `ADMIN` token. We now fail fast instead of booting insecurely.
 */

const INSECURE_JWT_SECRETS = new Set([
  'dev-jwt-secret-change-in-production',
  'dev-refresh-secret-change-in-production',
  'dev_jwt_secret_change_in_production',
  'dev_refresh_secret_change_in_production',
  'your_super_secret_jwt_key_at_least_32_chars',
  'your_super_secret_refresh_key_at_least_32_chars',
  'your_super_secret_jwt_key_change_this_in_production',
  'your_super_secret_refresh_key_change_this_in_production',
  'your_jwt_secret_key_here',
  'your_refresh_secret_key_here',
  'changeme',
  'secret',
]);

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase()),
  );

const intFrom = (fallback: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return fallback;
      const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    });

/** Comma separated list -> trimmed array (used for CORS allow-lists). */
const listFrom = (fallback: string[]) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : fallback,
    );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: intFrom(5000),

  DATABASE_URL: z.string().default(''),
  REDIS_URL: z.string().optional(),

  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_RESET_EXPIRES_IN: z.string().default('15m'),

  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ADMIN_URL: z.string().default('http://localhost:5174'),
  CORS_ORIGINS: listFrom([]),

  TRUST_PROXY: boolish.default(false),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: intFrom(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@gameshop.com'),

  CLOUDINARY_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  ADMIN_EMAIL: z.string().default('admin@gameshop.com'),

  /** OTP policy — see `utils/otp.ts`. */
  OTP_TTL_MS: intFrom(10 * 60 * 1000),
  OTP_MAX_ATTEMPTS: intFrom(5),
  OTP_RESEND_COOLDOWN_MS: intFrom(60 * 1000),
  OTP_MAX_PER_HOUR: intFrom(10),

  /** Log the OTP to stdout. Forced off in production. */
  OTP_LOG_TO_CONSOLE: boolish.default(true),

  /** Expose `/metrics` for Prometheus. */
  METRICS_ENABLED: boolish.default(true),

  RATE_LIMIT_WINDOW_MS: intFrom(60 * 1000),
  RATE_LIMIT_MAX: intFrom(100),

  /** Verbose SQL logging. Off by default — `query` logging is a real perf drag. */
  PRISMA_LOG_QUERIES: boolish.default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`   - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === 'production';

/** Production-only invariants. Booting without these is worse than not booting. */
const problems: string[] = [];

if (isProd) {
  if (!raw.DATABASE_URL) problems.push('DATABASE_URL is required in production');
  if (raw.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters in production');
  if (raw.JWT_REFRESH_SECRET.length < 32) {
    problems.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
  }
  if (INSECURE_JWT_SECRETS.has(raw.JWT_SECRET)) problems.push('JWT_SECRET is a well-known placeholder value');
  if (INSECURE_JWT_SECRETS.has(raw.JWT_REFRESH_SECRET)) {
    problems.push('JWT_REFRESH_SECRET is a well-known placeholder value');
  }
  if (raw.JWT_SECRET === raw.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }
}

if (problems.length > 0) {
  // eslint-disable-next-line no-console
  console.error('❌ Refusing to start with an insecure configuration:');
  for (const problem of problems) console.error(`   - ${problem}`);
  process.exit(1);
}

export const env = {
  port: raw.API_PORT,
  nodeEnv: raw.NODE_ENV,
  isDev: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  isProd,

  database: { url: raw.DATABASE_URL },
  redis: {
    url: raw.REDIS_URL ?? '',
    get enabled() {
      return Boolean(raw.REDIS_URL);
    },
  },

  jwt: {
    secret: raw.JWT_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    expiresIn: raw.JWT_EXPIRES_IN,
    refreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
    resetExpiresIn: raw.JWT_RESET_EXPIRES_IN,
  },

  frontend: { url: raw.FRONTEND_URL, adminUrl: raw.ADMIN_URL },

  /**
   * CORS allow-list. Explicit `CORS_ORIGINS` wins; otherwise the two known web
   * origins are used. In production `localhost` defaults are dropped so a
   * misconfigured deploy cannot silently allow a local origin.
   */
  corsOrigins: (() => {
    const base = raw.CORS_ORIGINS.length > 0 ? raw.CORS_ORIGINS : [raw.FRONTEND_URL, raw.ADMIN_URL];
    const unique = Array.from(new Set(base.filter(Boolean)));
    return isProd ? unique.filter((origin) => !origin.includes('localhost') && !origin.includes('127.0.0.1')) : unique;
  })(),

  trustProxy: raw.TRUST_PROXY,

  smtp: {
    host: raw.SMTP_HOST,
    port: raw.SMTP_PORT,
    user: raw.SMTP_USER,
    password: raw.SMTP_PASSWORD,
    from: raw.SMTP_FROM,
    get configured() {
      return Boolean(raw.SMTP_USER && raw.SMTP_PASSWORD);
    },
  },

  cloudinary: {
    name: raw.CLOUDINARY_NAME,
    apiKey: raw.CLOUDINARY_API_KEY,
    apiSecret: raw.CLOUDINARY_API_SECRET,
  },

  adminEmail: raw.ADMIN_EMAIL,

  otp: {
    ttlMs: raw.OTP_TTL_MS,
    maxAttempts: raw.OTP_MAX_ATTEMPTS,
    resendCooldownMs: raw.OTP_RESEND_COOLDOWN_MS,
    maxPerHour: raw.OTP_MAX_PER_HOUR,
    // Never write credentials-adjacent secrets to production logs.
    logToConsole: isProd ? false : raw.OTP_LOG_TO_CONSOLE,
  },

  metrics: { enabled: raw.METRICS_ENABLED },

  rateLimit: { windowMs: raw.RATE_LIMIT_WINDOW_MS, max: raw.RATE_LIMIT_MAX },

  logging: { sqlQueries: raw.PRISMA_LOG_QUERIES && !isProd },
} as const;

export type Env = typeof env;
