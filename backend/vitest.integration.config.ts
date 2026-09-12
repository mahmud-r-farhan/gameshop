import { defineConfig } from 'vitest/config';

/**
 * Integration-test configuration.
 *
 * These boot the real Express app against a real PostgreSQL database and assert
 * end-to-end behaviour (validation → service → persistence → HTTP response).
 *
 * CI provisions the database as a service container. Locally:
 *
 *   docker compose up -d postgres
 *   DATABASE_URL=postgresql://gameshop:gameshop_dev@localhost:5432/gameshop_test \
 *     npm run test:integration
 *
 * When `RUN_INTEGRATION_TESTS` is not `true` the suite skips itself instead of
 * failing, so `npm run test:integration` is safe to run in an environment without
 * a database.
 */
export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // `tests/integration/` is scaffolding for now: the suite is added alongside
    // the CI Postgres service. Without this flag `npm run test:integration`
    // would fail on an empty directory rather than reporting a clean no-op.
    passWithNoTests: true,
    globals: false,
    restoreMocks: true,
    setupFiles: ['tests/setup.ts'],
    // Shared database state — never run these files in parallel.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage-integration',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
