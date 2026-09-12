import { Router, type Response } from 'express';
import prisma from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { asyncHandler } from '../middleware/validate.js';
import { env } from '../config/env.js';

/**
 * Health endpoints.
 *
 * The API is mounted under `/api/v1`, but every Dockerfile `HEALTHCHECK`,
 * docker-compose `healthcheck` and the deploy workflow probed `/health` at the
 * root — a path that returned 404. Containers were therefore permanently
 * "unhealthy" and `curl -f …/health || exit 1` failed every production deploy.
 *
 * `app.ts` mounts this router at both `/health` and `/api/v1/health` so existing
 * probes keep working while the versioned path stays canonical.
 */

const router = Router();

type CheckState = 'UP' | 'DOWN';

interface HealthBody {
  status: 'UP' | 'DEGRADED';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, CheckState | { status: CheckState; latencyMs: number }>;
}

/** A check may be recorded as a bare state or as `{ status, latencyMs }`. */
function isUp(check: HealthBody['checks'][string]): boolean {
  return typeof check === 'string' ? check === 'UP' : check.status === 'UP';
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latencyMs: number }> {
  const started = process.hrtime.bigint();
  try {
    await fn();
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    return { ok: true, latencyMs: Math.round(latencyMs * 100) / 100 };
  } catch {
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    return { ok: false, latencyMs: Math.round(latencyMs * 100) / 100 };
  }
}

/** Liveness: is the process up? Never touches a dependency. */
router.get('/live', (_req, res: Response) => {
  res.json({ status: 'UP', uptime: process.uptime() });
});

/** Readiness: can this replica serve traffic right now? */
router.get(
  '/ready',
  asyncHandler(async (_req, res: Response) => {
    const database = await timed(async () => {
      await prisma.$queryRaw`SELECT 1`;
    });
    if (!database.ok) {
      res.status(503).json({ status: 'DOWN', checks: { database: 'DOWN' } });
      return;
    }
    res.json({ status: 'UP', checks: { database: 'UP', latencyMs: database.latencyMs } });
  }),
);

/** Full health report used by dashboards and container healthchecks. */
router.get(
  '/',
  asyncHandler(async (_req, res: Response) => {
    const checks: HealthBody['checks'] = {};

    const database = await timed(async () => {
      await prisma.$queryRaw`SELECT 1`;
    });
    checks.database = { status: database.ok ? 'UP' : 'DOWN', latencyMs: database.latencyMs };

    const redis = getRedis();
    if (redis) {
      const result = await timed(async () => {
        // `ioredis` exposes `status`; a lightweight probe avoids a round trip
        // when the connection is already known to be down.
        const status = (redis as unknown as { status?: string }).status;
        if (status && status !== 'ready') throw new Error(`redis ${status}`);
      });
      checks.redis = { status: result.ok ? 'UP' : 'DOWN', latencyMs: result.latencyMs };
    } else {
      checks.redis = 'UP'; // optional dependency; in-memory fallback is active
    }

    const degraded = !isUp(checks.database);
    const body: HealthBody = {
      status: degraded ? 'DEGRADED' : 'UP',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '1.0.0',
      environment: env.nodeEnv,
      checks,
    };

    res.status(degraded ? 503 : 200).json(body);
  }),
);

export default router;
