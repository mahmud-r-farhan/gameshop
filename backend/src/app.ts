import crypto from 'node:crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import routes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import { httpRequestDuration, httpRequestsTotal, normalizeRoute } from './config/metrics.js';

export interface AppOptions {
  /** Apply the global `/api` rate limiter. Disabled in tests to avoid flakiness. */
  rateLimit?: boolean;
  /** Serve `/uploads` from disk. */
  serveUploads?: boolean;
}

/**
 * Build the Express application.
 *
 * Extracted from `index.ts` so integration tests can mount the real app with
 * `supertest` without binding a port or opening a database connection at import
 * time — the previous module started the server as a side effect of being
 * imported, which made it untestable.
 */
export function createApp(options: AppOptions = {}): Express {
  const { rateLimit = true, serveUploads = false } = options;
  const app = express();

  // Behind nginx every peer address is the proxy itself. Without this, rate
  // limiting buckets the entire internet into one key and `req.ip` is useless.
  app.set('trust proxy', env.trustProxy ? 1 : false);
  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  app.use(
    helmet({
      // The API only serves JSON; a strict CSP here would break nothing but is
      // still worth setting so an accidental HTML response cannot run scripts.
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/curl requests have no `Origin` header — allow those.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.length === 0) {
          return callback(null, env.isDev);
        }
        return callback(null, env.corsOrigins.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request metrics + access log.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();

    res.on('finish', () => {
      const route = normalizeRoute(req);
      const labels = { method: req.method, route, status: String(res.statusCode) };
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);

      if (!env.isTest) {
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'request',
            requestId: req.id,
            method: req.method,
            path: req.originalUrl,
            route,
            status: res.statusCode,
            durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
            ip: req.ip,
          }),
        );
      }
    });

    next();
  });

  /**
   * Health is mounted at the root as well as under `/api/v1`.
   *
   * Container healthchecks and the deploy pipeline probe `/health`, but the API
   * router is mounted at `/api/v1` — so every probe was hitting a 404 and the
   * backend container was reported unhealthy forever.
   */
  app.use('/health', healthRoutes);
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: { service: 'GameShop API', version: 'v1', docs: '/api/v1', health: '/health' },
    });
  });

  if (rateLimit) {
    app.use('/api/', apiLimiter);
  }

  app.use('/api/v1', routes);

  if (serveUploads) {
    app.use('/uploads', express.static('uploads', { maxAge: '1d', index: false }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** Augment Express's request with the correlation id. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export default createApp;
