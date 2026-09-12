/**
 * Global test setup.
 *
 * Runs before any test module is evaluated, which matters because
 * `src/config/env.ts` reads `process.env` exactly once at import time.
 */

process.env.NODE_ENV = 'test';

// Distinct, >=32-char secrets so token tests exercise the real signing paths.
process.env.JWT_SECRET ??= 'test-access-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
process.env.JWT_RESET_EXPIRES_IN ??= '15m';

process.env.DATABASE_URL ??= 'postgresql://gameshop:test@localhost:5432/gameshop_test';
process.env.API_PORT ??= '0';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.ADMIN_URL ??= 'http://localhost:5174';

// Keep test output readable and deterministic.
process.env.OTP_LOG_TO_CONSOLE = 'false';
process.env.PRISMA_LOG_QUERIES = 'false';
delete process.env.REDIS_URL;

export {};
