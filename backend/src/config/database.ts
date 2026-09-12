import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { env } from './env.js';

/**
 * Transaction client type used across the service layer.
 *
 * Declaring it once (rather than `any` at every call site) keeps interactive
 * transactions fully typed against the generated client while still compiling in
 * environments where the client has not been generated yet.
 */
export type PrismaTx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Single shared Prisma client.
 *
 * Re-using one instance across hot reloads avoids exhausting the Postgres
 * connection pool during development (every HMR cycle previously leaked a client
 * with its own pool).
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // `query` logging writes a line per statement and measurably slows the API
    // down; it is opt-in rather than on for every development boot.
    log: env.logging.sqlQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
