import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import prisma from './config/database.js';
import { disconnectInfra, initInfra } from './config/redis.js';
import { setupSocketIO } from './socket/socketHandlers.js';

/**
 * Process bootstrap.
 *
 * Kept deliberately thin: `createApp()` in `app.ts` owns the Express wiring so it
 * can be mounted by tests without any of the side effects below.
 */

const app = createApp({ rateLimit: true, serveUploads: true });
const httpServer = createServer(app);

let shuttingDown = false;

async function start(): Promise<void> {
  try {
    await initInfra();
    await prisma.$connect();
    console.log('✅ Database connected');

    const io = setupSocketIO(httpServer);
    app.set('io', io);

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(env.port, '0.0.0.0', resolve);
    });

    console.log(`🚀 Server running on port ${env.port}`);
    console.log(`📍 Environment: ${env.nodeEnv}`);
    console.log(`🔗 CORS origins: ${env.corsOrigins.join(', ') || '(same-origin only)'}`);
    console.log(`❤️  Health: http://localhost:${env.port}/health`);
    if (env.metrics.enabled) {
      console.log(`📊 Metrics: http://localhost:${env.port}/api/v1/metrics`);
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await shutdown(1);
  }
}

/**
 * Graceful shutdown.
 *
 * The previous handlers disconnected Prisma and called `process.exit`
 * immediately, dropping in-flight requests on the floor and making rolling
 * deploys visibly lossy. We now stop accepting connections, let the existing ones
 * drain (bounded), then close the data connections.
 */
async function shutdown(exitCode: number, signal?: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  if (signal) console.log(`\n${signal} received — shutting down gracefully…`);

  const forceExit = setTimeout(() => {
    console.error('⏱  Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectInfra();
    await prisma.$disconnect();
    console.log('👋 Shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown(0, 'SIGINT'));
process.on('SIGTERM', () => void shutdown(0, 'SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  // State after an uncaught exception is undefined — log and let the supervisor
  // restart the process rather than limp along.
  console.error('Uncaught exception:', error);
  void shutdown(1, 'uncaughtException');
});

void start();

export { app, httpServer };
export default app;
