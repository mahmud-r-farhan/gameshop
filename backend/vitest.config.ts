import { defineConfig } from 'vitest/config';

/**
 * Infrastructure-free test configuration.
 *
 * Two directories, one requirement: Prisma is mocked, so nothing here needs a
 * database, a port, or Docker.
 *
 *   * `tests/unit/**` — pure functions, middleware and services in isolation.
 *   * `tests/api/**`  — the real Express app driven by supertest. Exercises
 *                       routing, Zod validation, auth middleware, error mapping
 *                       and the JSON envelope end to end.
 *
 * They run anywhere, including a contributor's laptop and the default `npm test`
 * job in CI. Database-backed tests live in `vitest.integration.config.ts` and
 * require a real PostgreSQL instance.
 */
export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integration/**'],
    globals: false,
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // process bootstrap
        'src/**/*.d.ts',
        'src/config/database.ts', // thin Prisma singleton
      ],
      // Current state: ~94% statements / ~91% branches. The floor sits just
      // below that so a large untested addition cannot silently land, and it
      // should be ratcheted up whenever coverage improves.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 85,
        lines: 90,
      },
    },
  },
});
